"""Eval harness — reproduces every number the deck quotes.

    python -m evals.generate     # deterministic dataset (seeded)
    python -m evals.run          # fits calibration, measures, writes evals/out/*

Outputs:
- calibration.json      per-detector score->P(real failure) knots (calibration split)
- results.json          per-category recall/precision with COUNTS + Wilson 95% CIs,
                        gate metrics, abstention metric, reliability bins, budget
                        calibration — byte-stable across machines (accuracy only)
- runtime_env.json      the hardware-dependent measurements (wall time, latency
                        percentiles, cost accounting) + machine identity
- operating_sweep.json  threshold -> FP-rate/recall per category (the operating-
                        point console reads this)
- coverage_weights.json per-detector marginal recall (the scheduler's coverage
                        score semantics)
Blind hold-out: drop teammate-written cases into evals/blind/*.jsonl (same
schema); they are scored and reported separately (anti-circularity).
"""
from __future__ import annotations

import asyncio
import json
import math
import os
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("CP_DATA_DIR", str(ROOT / "evals" / "out" / "data"))

import sys  # noqa: E402
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp1252 consoles

from controlplane import fusion                              # noqa: E402
from controlplane.detectors.base import CheckContext         # noqa: E402
from controlplane.episode import episodes                    # noqa: E402
from controlplane.models import DecisionType, GroundingVerdict, Source, SourceTrust  # noqa: E402
from controlplane.pipeline import RequestEnvelope, get_policy_engine, run_egress, run_ingress  # noqa: E402
from controlplane.scheduler import run_detectors             # noqa: E402
from controlplane.telemetry import telemetry                 # noqa: E402

OUT = ROOT / "evals" / "out"
DATA = ROOT / "evals" / "data" / "dataset.jsonl"
CATEGORIES = ["grounding", "privacy", "toxicity", "injection", "cost"]


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (round(max(0, centre - margin), 4), round(min(1, centre + margin), 4))


def _sources(rec: dict) -> list[Source]:
    return [Source(id=s["id"], text=s["text"], trust=SourceTrust(s["trust"]))
            for s in rec.get("sources", [])]


async def fit_calibration(records: list[dict]) -> dict:
    """Per-detector binned precision on the calibration split."""
    eng = get_policy_engine()
    samples: dict[str, list[tuple[float, int]]] = defaultdict(list)
    for rec in records:
        pack = eng.resolve(rec["use_case"]).pack
        labels = set(rec["labels"])
        for stage in ("ingress", "egress"):
            ctx = CheckContext(
                user_text=rec["user_text"], output_text=rec["sim_output"],
                sources=_sources(rec), pack=pack, stage=stage,
                tokens_out=len(rec["sim_output"].split()))
            res = await run_detectors(ctx, pack.latency_budget_ms, stage=stage)
            for s in res.signals:
                samples[s.detector].append((s.score, 1 if s.category in labels else 0))
    calibration: dict[str, dict] = {}
    for det, pts in samples.items():
        if len(pts) < 12:
            continue
        pts.sort()
        bins = 6
        step = max(1, len(pts) // bins)
        raw: list[tuple[float, float, int]] = []  # (mean score, mean label, n)
        for i in range(0, len(pts), step):
            chunk = pts[i:i + step]
            raw.append((round(sum(p for p, _ in chunk) / len(chunk), 4),
                        sum(l for _, l in chunk) / len(chunk), len(chunk)))
        # merge bins with (near-)identical x — duplicate knots make the
        # interpolation ill-defined (weighted mean of y)
        merged: list[list[float]] = []
        for x, y, n in raw:
            if merged and abs(x - merged[-1][0]) < 1e-6:
                tot = merged[-1][2] + n
                merged[-1][1] = (merged[-1][1] * merged[-1][2] + y * n) / tot
                merged[-1][2] = tot
            else:
                merged.append([x, y, n])
        # isotonic pooling (PAVA-style): pool adjacent violators
        i = 1
        while i < len(merged):
            if merged[i][1] < merged[i - 1][1]:
                tot = merged[i - 1][2] + merged[i][2]
                merged[i - 1][1] = (merged[i - 1][1] * merged[i - 1][2]
                                    + merged[i][1] * merged[i][2]) / tot
                merged[i - 1][0] = max(merged[i - 1][0], merged[i][0])
                merged[i - 1][2] = tot
                del merged[i]
                i = max(1, i - 1)
            else:
                i += 1
        calibration[det] = {"scores": [round(m[0], 4) for m in merged],
                            "probs": [round(m[1], 4) for m in merged],
                            "n": len(pts)}
    return calibration


async def run_test(records: list[dict], tag: str) -> dict:
    eng = get_policy_engine()
    episodes.episodes.clear()
    telemetry.__init__()

    flagged: dict[str, list[tuple[int, int]]] = {c: [] for c in CATEGORIES}  # (label, pred)
    fused_probs: dict[str, list[tuple[float, int]]] = {c: [] for c in CATEGORIES}
    gate = {"held_tainted": 0, "tainted_total": 0, "held_clean": 0, "clean_total": 0}
    abstain = {"correct": 0, "total": 0}
    overlap = {"both_labels": 0, "single_debit": 0, "total": 0}
    ingress_blocked_ids = set()

    t0 = time.time()
    for rec in records:
        lp = eng.resolve(rec["use_case"])
        ep_id = rec["episode"]["id"] if rec.get("episode") else rec["id"]
        env = RequestEnvelope(
            use_case=rec["use_case"], episode_id=f"{tag}-{ep_id}",
            identity=f"{tag}-ident-{ep_id}", user_text=rec["user_text"],
            sources=_sources(rec))
        blocked, _, _ = await run_ingress(env, lp)
        if blocked:
            ingress_blocked_ids.add(rec["id"])
        result = await run_egress(
            env, lp, rec["sim_output"], rec.get("tool_calls", []), None,
            len(rec["user_text"].split()), len(rec["sim_output"].split()),
            "sim/eval")
        d = result.decision
        labels = set(rec["labels"])
        risk = {r.category: r for r in d.risk}

        for c in CATEGORIES:
            pred = int(risk[c].prob >= lp.pack.threshold(c).flag)
            if c == "injection" and rec["id"] in ingress_blocked_ids:
                pred = 1
            flagged[c].append((int(c in labels), pred))
            fused_probs[c].append((risk[c].prob, int(c in labels)))

        if rec.get("note") == "abstain_expected":
            abstain["total"] += 1
            if d.grounding_verdict == GroundingVerdict.INSUFFICIENT_EVIDENCE:
                abstain["correct"] += 1
        if rec.get("note") == "overlap_case":
            overlap["total"] += 1
            if risk["grounding"].prob > 0 and risk["privacy"].prob > 0:
                overlap["both_labels"] += 1
            if d.correlated_labels:
                overlap["single_debit"] += 1
        if rec.get("note") == "gate_must_hold":
            gate["tainted_total"] += 1
            if d.decision == DecisionType.HOLD_ACTION:
                gate["held_tainted"] += 1
        if rec.get("note") == "gate_must_pass":
            gate["clean_total"] += 1
            if d.decision == DecisionType.HOLD_ACTION:
                gate["held_clean"] += 1
    wall = time.time() - t0

    per_cat = {}
    for c in CATEGORIES:
        rows = flagged[c]
        tp = sum(1 for l, p in rows if l and p)
        fn = sum(1 for l, p in rows if l and not p)
        fp = sum(1 for l, p in rows if not l and p)
        tn = sum(1 for l, p in rows if not l and not p)
        pos, neg = tp + fn, fp + tn
        per_cat[c] = {
            "injected": pos, "caught": tp, "missed": fn,
            "recall": round(tp / pos, 4) if pos else None,
            "recall_ci95": wilson(tp, pos) if pos else None,
            "benign": neg, "false_flags": fp,
            "fp_rate": round(fp / neg, 4) if neg else None,
            "fp_rate_ci95": wilson(fp, neg) if neg else None,
            "precision": round(tp / (tp + fp), 4) if (tp + fp) else None,
        }
    per_cat["bias"] = {
        "recall": ("n/a (annotate-only by design — structurally capped at "
                   "ANNOTATE, regression-tested in tests/test_bias_scope.py)"),
    }

    # reliability bins (10) over all categories pooled
    bins = [{"lo": i / 10, "hi": (i + 1) / 10, "n": 0, "pred_sum": 0.0, "label_sum": 0}
            for i in range(10)]
    for c in CATEGORIES:
        for p, l in fused_probs[c]:
            if p <= 0:
                continue
            b = bins[min(9, int(p * 10))]
            b["n"] += 1
            b["pred_sum"] += p
            b["label_sum"] += l
    reliability = [{"bin": f"{b['lo']:.1f}-{b['hi']:.1f}", "n": b["n"],
                    "mean_pred": round(b["pred_sum"] / b["n"], 3) if b["n"] else None,
                    "empirical": round(b["label_sum"] / b["n"], 3) if b["n"] else None}
                   for b in bins]
    ece = sum(b["n"] * abs((b["pred_sum"] - b["label_sum"]) / b["n"])
              for b in bins if b["n"]) / max(1, sum(b["n"] for b in bins))

    snap = telemetry.snapshot()
    return {
        "records": len(records), "wall_seconds": round(wall, 1),
        "per_category": per_cat,
        "action_gate": {
            **gate,
            "tainted_hold_rate": round(gate["held_tainted"] / gate["tainted_total"], 4)
            if gate["tainted_total"] else None,
            "tainted_hold_ci95": wilson(gate["held_tainted"], gate["tainted_total"])
            if gate["tainted_total"] else None,
            "clean_false_hold_rate": round(gate["held_clean"] / gate["clean_total"], 4)
            if gate["clean_total"] else None,
        },
        "abstention": {**abstain,
                       "rate": round(abstain["correct"] / abstain["total"], 4)
                       if abstain["total"] else None},
        "overlap_handling": overlap,
        "reliability_bins": reliability,
        "ece": round(ece, 4),
        "latency_ms": snap["latency_ms"],
        "coverage_p50": snap["coverage_p50"],
        "cost": snap["cost_inr"],
        "llm_vs_non_llm": snap["llm_vs_non_llm"],
        "decisions": snap["decisions"],
    }


async def budget_calibration(records: list[dict]) -> dict:
    """Benign-episode cumulative expected loss -> suggested budgets by
    percentile dial, bucketed by episode length (length-normalised)."""
    eng = get_policy_engine()
    episodes.episodes.clear()
    by_ep: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        if r.get("note") == "benign_episode":
            by_ep[r["episode"]["id"]].append(r)
    losses_by_bucket: dict[str, list[float]] = defaultdict(list)
    for ep_id, recs in by_ep.items():
        recs.sort(key=lambda r: r["episode"]["turn"])
        lp = eng.resolve(recs[0]["use_case"])
        for rec in recs:
            env = RequestEnvelope(use_case=rec["use_case"],
                                  episode_id=f"bc-{ep_id}", identity=f"bc-{ep_id}",
                                  user_text=rec["user_text"], sources=_sources(rec))
            await run_egress(env, lp, rec["sim_output"], [], None, 5,
                             len(rec["sim_output"].split()), "sim/eval")
        ep = episodes.episodes[f"bc-{ep_id}"]
        n = len(recs)
        bucket = "3-5" if n <= 5 else ("6-8" if n <= 8 else "9+")
        losses_by_bucket[bucket].append(ep.expected_loss(lp.pack))

    def pct(vals, q):
        if not vals:
            return None
        s = sorted(vals)
        return round(s[min(len(s) - 1, int(q / 100 * len(s)))], 2)

    return {bucket: {"n": len(v), "p90": pct(v, 90), "p95": pct(v, 95),
                     "p99": pct(v, 99)}
            for bucket, v in sorted(losses_by_bucket.items())}


def sweep(fused: dict[str, list[tuple[float, int]]]) -> dict:
    out = {}
    for c, rows in fused.items():
        table = []
        for t in [round(0.05 * i, 2) for i in range(1, 20)]:
            tp = sum(1 for p, l in rows if l and p >= t)
            fn = sum(1 for p, l in rows if l and p < t)
            fp = sum(1 for p, l in rows if not l and p >= t)
            tn = sum(1 for p, l in rows if not l and p < t)
            table.append({"threshold": t,
                          "recall": round(tp / (tp + fn), 4) if (tp + fn) else None,
                          "fp_rate": round(fp / (fp + tn), 4) if (fp + tn) else 0.0})
        out[c] = table
    return out


async def coverage_weights(records: list[dict]) -> dict:
    """Marginal recall per detector per category on the test split — the
    denominator of the coverage score."""
    eng = get_policy_engine()
    hits: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    totals: dict[str, int] = defaultdict(int)
    for rec in records:
        labels = set(rec["labels"])
        if not labels:
            continue
        pack = eng.resolve(rec["use_case"]).pack
        for c in labels:
            if c in CATEGORIES:
                totals[c] += 1
        for stage in ("ingress", "egress"):
            ctx = CheckContext(user_text=rec["user_text"], output_text=rec["sim_output"],
                               sources=_sources(rec), pack=pack, stage=stage,
                               tokens_out=len(rec["sim_output"].split()))
            res = await run_detectors(ctx, pack.latency_budget_ms, stage=stage)
            seen = set()
            for s in res.signals:
                if s.category in labels and s.score >= 0.5 and (s.detector, s.category) not in seen:
                    seen.add((s.detector, s.category))
                    hits[s.detector][s.category] += 1
    return {det: {c: round(n / totals[c], 4) for c, n in cats.items() if totals[c]}
            for det, cats in hits.items()}


async def main() -> None:
    records = [json.loads(l) for l in DATA.read_text(encoding="utf-8").splitlines()]
    cal_split = [r for r in records if r["split"] == "calibration"]
    test_split = [r for r in records if r["split"] == "test"]
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"dataset: {len(records)} ({len(cal_split)} calibration / {len(test_split)} test)")
    print("fitting per-detector calibration on the calibration split…")
    calibration = await fit_calibration(cal_split)
    (OUT / "calibration.json").write_text(json.dumps(calibration, indent=1))
    fusion._calibration = None  # force reload with the fitted tables
    fusion._calibration_source = "eval_holdout"

    print("running test split through the full pipeline…")
    results = await run_test(test_split, tag="test")

    print("computing operating-point sweep…")
    fused: dict[str, list[tuple[float, int]]] = {c: [] for c in CATEGORIES}
    # reuse the reliability data path: re-derive from a light second pass over
    # stored per-record fused probabilities inside run_test would need refactor;
    # instead sweep from the calibration-split signals fused fresh:
    eng = get_policy_engine()
    episodes.episodes.clear()
    for rec in test_split:
        if rec.get("episode"):
            continue  # single-turn only for the sweep
        lp = eng.resolve(rec["use_case"])
        signals = []
        for stage in ("ingress", "egress"):  # injection lives at ingress
            ctx = CheckContext(user_text=rec["user_text"], output_text=rec["sim_output"],
                               sources=_sources(rec), pack=lp.pack, stage=stage,
                               tokens_out=len(rec["sim_output"].split()))
            res = await run_detectors(ctx, lp.pack.latency_budget_ms, stage=stage)
            signals.extend(res.signals)
        risks = fusion.fuse(signals, lp.pack.assumed_base_rate)
        labels = set(rec["labels"])
        for r in risks:
            fused[r.category].append((r.prob, int(r.category in labels)))
    (OUT / "operating_sweep.json").write_text(json.dumps(
        {"categories": sweep(fused), "note": "fp_rate on benign test traffic vs "
         "recall on injected failures, per fused-probability threshold"}, indent=1))

    print("computing coverage weights…")
    weights = await coverage_weights(test_split)
    (OUT / "coverage_weights.json").write_text(json.dumps(weights, indent=1))

    print("calibrating episode budgets on benign episodes…")
    budgets = await budget_calibration(test_split)

    blind_dir = ROOT / "evals" / "blind"
    blind_results = None
    blind_files = list(blind_dir.glob("*.jsonl")) if blind_dir.exists() else []
    if blind_files:
        blind = [json.loads(l) for f in blind_files
                 for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
        for r in blind:
            r.setdefault("split", "blind")
        print(f"scoring blind hold-out ({len(blind)} records)…")
        blind_results = await run_test(blind, tag="blind")

    # Hardware-dependent fields live in runtime_env.json so results.json stays
    # byte-stable across machines (accuracy metrics reproduce exactly; timing
    # and cost do not). /admin/evals merges them back for the dashboard.
    import platform
    hw_fields = ("wall_seconds", "latency_ms", "cost")
    runtime_env = {
        "note": ("hardware-dependent measurements split out of results.json; "
                 "quoted latency/throughput/cost figures come from "
                 "evals/out/load_test.json"),
        "machine": platform.node() or "unknown",
        "platform": platform.platform(),
        "python": platform.python_version(),
    }
    for tag, block in (("test", results), ("blind", blind_results)):
        if block:
            runtime_env[tag] = {k: block.pop(k) for k in hw_fields if k in block}
    (OUT / "runtime_env.json").write_text(json.dumps(runtime_env, indent=1))

    results_full = {
        "generated_with": "evals/generate.py (seed 20260823)",
        "detector_profile": os.getenv("CP_DETECTOR_PROFILE", "lite"),
        "eval_base_rate_note": ("injected-failure rate 28.0% by construction "
                                "(27.3% on the test split); fusion.EVAL_BASE_RATE "
                                "models it as 0.30 — a stated, rounded modelling "
                                "constant. Deployment probabilities are "
                                "prior-shifted to each pack's assumed_base_rate."),
        "test": results,
        "budget_calibration_inr": budgets,
        "blind_holdout": blind_results or "none provided (drop cases into evals/blind/)",
    }
    (OUT / "results.json").write_text(json.dumps(results_full, indent=1))
    print(json.dumps(results["per_category"], indent=1))
    print("gate:", results["action_gate"])
    print("abstention:", results["abstention"])
    print("latency:", runtime_env["test"]["latency_ms"])
    print(f"\nwrote {OUT}/results.json, runtime_env.json, operating_sweep.json, "
          f"calibration.json, coverage_weights.json")


if __name__ == "__main__":
    asyncio.run(main())

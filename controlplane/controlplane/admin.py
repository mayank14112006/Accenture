"""Admin / dashboard API."""
from __future__ import annotations

import json
import time
from pathlib import Path

import yaml
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .config import settings
from .episode import episodes
from .feedback import feedback
from .fusion import calibration_source
from .ledger import ledger
from .models import Override
from .policy import sign_pack_file
from .telemetry import telemetry

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics")
async def metrics():
    snap = telemetry.snapshot()
    snap["calibration_source"] = calibration_source()
    snap["detector_profile"] = settings.detector_profile
    snap["provider"] = settings.provider
    return snap


@router.get("/decisions")
async def decisions(limit: int = 50):
    from .pipeline import recent_decisions
    return [d.model_dump() for d in recent_decisions(limit)]


@router.get("/decisions/{decision_id}")
async def decision_detail(decision_id: str):
    from .pipeline import get_decision
    d = get_decision(decision_id)
    if not d:
        return JSONResponse({"error": "not found"}, status_code=404)
    return d.model_dump()


@router.get("/episodes")
async def list_episodes():
    from .pipeline import get_policy_engine
    eng = get_policy_engine()
    out = []
    for ep in episodes.episodes.values():
        pack = eng.resolve(ep.use_case).pack
        out.append({
            "episode_id": ep.episode_id, "use_case": ep.use_case,
            "identity": ep.identity, "turns": ep.turn,
            "expected_loss_inr": round(ep.expected_loss(pack), 2),
            "budget_inr": pack.episode_budget_inr,
            "escalated": ep.escalated,
            "taints": len(ep.unresolved_taints()),
            "gate_events": len(ep.gate_events),
            "created": ep.created,
        })
    return sorted(out, key=lambda e: -e["created"])[:100]


@router.get("/episodes/{episode_id}")
async def episode_detail(episode_id: str):
    from .pipeline import get_policy_engine
    ep = episodes.episodes.get(episode_id)
    if not ep:
        return JSONResponse({"error": "not found"}, status_code=404)
    pack = get_policy_engine().resolve(ep.use_case).pack
    return {
        "episode_id": ep.episode_id, "use_case": ep.use_case,
        "identity": ep.identity, "turns": ep.turn,
        "hazard": {k: round(v, 4) for k, v in ep.hazard.items()},
        "expected_loss_inr": round(ep.expected_loss(pack), 2),
        "budget_inr": pack.episode_budget_inr,
        "escalated": ep.escalated,
        "claims": [c.model_dump() for c in ep.claims.values()],
        "gate_events": ep.gate_events,
        "identity_window_total_inr": round(
            episodes.identity_window_total(ep.identity,
                                           pack.identity_window.window_hours), 2),
        "identity_window_limit_inr": pack.identity_window.limit_inr,
        "decision_ids": ep.decision_ids,
    }


# ---------------------------------------------------------------- policies
@router.get("/policies")
async def policies():
    from .pipeline import get_policy_engine
    eng = get_policy_engine()
    return {
        "packs": {name: {
            "version": lp.pack.version, "jurisdiction": lp.pack.jurisdiction,
            "mode": lp.pack.mode, "latency_budget_ms": lp.pack.latency_budget_ms,
            "failure_mode": lp.pack.failure_mode,
            "episode_budget_inr": lp.pack.episode_budget_inr,
            "budget_percentile": lp.pack.budget_percentile,
            "thresholds": {k: v.model_dump() for k, v in lp.pack.thresholds.items()},
            "severities_inr": lp.pack.severities_inr,
            "tools": lp.pack.tools,
            "pack_hash": lp.pack_hash, "signed": lp.signed,
            "loaded_at": lp.loaded_at,
        } for name, lp in eng.all().items()},
        "refusals": eng.refusals[-5:],
    }


@router.post("/policies/reload")
async def reload_policies():
    from .pipeline import get_policy_engine
    errors = get_policy_engine().reload()
    return {"reloaded": True, "errors": errors}


@router.post("/policies/{name}/jurisdiction")
async def switch_jurisdiction(name: str, request: Request):
    """Geography switch with NO code change and NO restart: applies the
    jurisdiction overlay (policies/overlays/<CODE>.yaml) to the pack file,
    bumps the version, and lets hot-reload pick it up. Every subsequent
    decision records the new policy_version + pack_hash."""
    body = await request.json()
    code = body.get("jurisdiction", "").upper()
    overlay_path = settings.policies_dir / "overlays" / f"{code}.yaml"
    pack_path = settings.policies_dir / f"{name}.yaml"
    if not overlay_path.exists() or not pack_path.exists():
        return JSONResponse({"error": "unknown pack or jurisdiction overlay"},
                            status_code=404)
    base = yaml.safe_load(pack_path.read_text(encoding="utf-8"))
    overlay = yaml.safe_load(overlay_path.read_text(encoding="utf-8")) or {}
    _deep_merge(base, overlay)
    base["jurisdiction"] = code
    base["version"] = int(base.get("version", 1)) + 1
    pack_path.write_text(yaml.safe_dump(base, sort_keys=False, allow_unicode=True),
                         encoding="utf-8")
    sign_pack_file(pack_path)
    await ledger.append(kind="policy_change",
                        payload={"pack": name, "jurisdiction": code,
                                 "new_version": base["version"]})
    from .pipeline import get_policy_engine
    errors = get_policy_engine().reload()
    return {"pack": name, "jurisdiction": code, "new_version": base["version"],
            "errors": errors}


def _deep_merge(base: dict, overlay: dict) -> None:
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v


# ---------------------------------------------------------------- ledger
@router.get("/ledger")
async def ledger_entries(limit: int = 100, episode_id: str | None = None):
    return ledger.entries(limit=limit, episode_id=episode_id)


@router.get("/ledger/verify")
async def ledger_verify():
    return ledger.verify()


# ---------------------------------------------------------------- overrides
@router.post("/overrides")
async def submit_override(request: Request):
    body = await request.json()
    from .pipeline import get_decision
    dec = get_decision(body.get("decision_id", ""))
    ov = Override(
        decision_id=body.get("decision_id", ""),
        reviewer=body.get("reviewer", "unknown"),
        verdict=body.get("verdict", "confirm"),
        note=body.get("note", ""),
        severity=body.get("severity", "normal"))
    cats = ",".join(r.category for r in dec.risk if r.prob > 0) if dec else ""
    ov = feedback.submit(ov, categories=cats)
    await ledger.append(kind="override",
                        payload={"override_id": ov.id, "decision_id": ov.decision_id,
                                 "reviewer": ov.reviewer, "verdict": ov.verdict,
                                 "severity": ov.severity, "state": ov.state},
                        decision_id=ov.decision_id)
    return ov.model_dump()


@router.post("/overrides/{override_id}/approve")
async def approve_override(override_id: str, request: Request):
    body = await request.json()
    result = feedback.approve_second(override_id, body.get("approver", "unknown"))
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    if "error" not in result:
        await ledger.append(kind="override_second_approval",
                            payload={"override_id": override_id,
                                     "approver": body.get("approver")})
    return result


@router.get("/overrides")
async def list_overrides():
    return feedback.all()


@router.get("/overrides/rates")
async def override_rates():
    return feedback.reviewer_rates()


# ---------------------------------------------------------------- evals
@router.get("/evals")
async def eval_results():
    path = settings.evals_out_dir / "results.json"
    if not path.exists():
        return JSONResponse({"error": "no eval run found — run: python -m evals.run"},
                            status_code=404)
    data = json.loads(path.read_text())
    # results.json is byte-stable (accuracy metrics only); hardware-dependent
    # fields live in runtime_env.json — merge them back for the dashboard.
    rt_path = settings.evals_out_dir / "runtime_env.json"
    if rt_path.exists():
        rt = json.loads(rt_path.read_text())
        if isinstance(data.get("test"), dict) and isinstance(rt.get("test"), dict):
            data["test"].update(rt["test"])
        if isinstance(data.get("blind_holdout"), dict) and isinstance(rt.get("blind"), dict):
            data["blind_holdout"].update(rt["blind"])
        data["runtime_env"] = {k: v for k, v in rt.items() if k not in ("test", "blind")}
    return data


@router.get("/evals/sweep")
async def eval_sweep():
    path = settings.evals_out_dir / "operating_sweep.json"
    if not path.exists():
        return JSONResponse({"error": "no sweep found — run: python -m evals.run"},
                            status_code=404)
    return json.loads(path.read_text())


@router.post("/operating-point")
async def operating_point(request: Request):
    """The over/under-flagging tradeoff as an owned dial: give a target benign
    flag rate (alert budget), get the threshold per category that respects it,
    from the precomputed eval sweep. apply=true mutates the pack file
    (versioned, hot-reloaded, ledgered) — policy stays data."""
    body = await request.json()
    target_fp = float(body.get("target_fp_rate", 0.05))
    pack_name = body.get("pack", "")
    apply = bool(body.get("apply", False))
    path = settings.evals_out_dir / "operating_sweep.json"
    if not path.exists():
        return JSONResponse({"error": "no sweep found — run: python -m evals.run"},
                            status_code=404)
    sweep = json.loads(path.read_text())
    suggestion: dict[str, dict] = {}
    for cat, rows in sweep.get("categories", {}).items():
        best = None
        for row in rows:  # rows sorted by threshold asc
            if row["fp_rate"] <= target_fp:
                best = row
                break
        if best is None:
            best = rows[-1]
        suggestion[cat] = {"flag": best["threshold"],
                           "expected_fp_rate": best["fp_rate"],
                           "expected_recall": best["recall"]}
    applied = False
    if apply and pack_name:
        pack_path = settings.policies_dir / f"{pack_name}.yaml"
        if pack_path.exists():
            base = yaml.safe_load(pack_path.read_text(encoding="utf-8"))
            for cat, s in suggestion.items():
                base.setdefault("thresholds", {}).setdefault(cat, {})
                base["thresholds"][cat]["flag"] = round(float(s["flag"]), 3)
            base["version"] = int(base.get("version", 1)) + 1
            pack_path.write_text(yaml.safe_dump(base, sort_keys=False,
                                                allow_unicode=True), encoding="utf-8")
            sign_pack_file(pack_path)
            await ledger.append(kind="operating_point_change",
                                payload={"pack": pack_name, "target_fp": target_fp,
                                         "thresholds": {k: v["flag"] for k, v in
                                                        suggestion.items()}})
            from .pipeline import get_policy_engine
            get_policy_engine().reload()
            applied = True
    return {"target_fp_rate": target_fp, "suggested_flag_thresholds": suggestion,
            "applied": applied, "ts": time.time()}

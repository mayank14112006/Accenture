"""Latency-budget scheduler.

Each use case declares a latency budget (policy data). The scheduler runs the
largest detector set that fits, in parallel, with a per-detector timeout — and
reports an honest COVERAGE score.

Coverage semantics (defined, not vibes): coverage = risk-weighted recall
retained. Each detector carries a marginal-recall weight per category, measured
by the eval suite (evals/out/coverage_weights.json: how much of the injected
failures of each category only that detector catches). Coverage is the fraction
of total available recall represented by the detectors that actually RAN and
finished. "Checked at 62%" therefore means: an estimated 62% of catchable
failures were catchable in this pass — and the episode ledger applies an
uncertainty surcharge for the remainder (see episode.debit), so degraded
coverage debits MORE, never less.

Tier 0 NEVER sheds: deterministic checks survive any load (induced fail-open
is not a thing — see policy failure_mode for what happens if the checker
itself faults).
"""
from __future__ import annotations

import asyncio
import json
import time

from .config import settings
from .detectors import CheckContext, Detector, all_detectors
from .models import Signal, TierTrace

_weights: dict | None = None


def _load_weights() -> dict:
    global _weights
    if _weights is None:
        path = settings.evals_out_dir / "coverage_weights.json"
        if path.exists():
            _weights = json.loads(path.read_text())
        else:
            _weights = {}
    return _weights


def detector_weight(det: Detector) -> float:
    table = _load_weights().get(det.name)
    if table:
        return sum(table.values())
    return sum(det.recall_weight.values())


class ScheduleResult:
    def __init__(self) -> None:
        self.signals: list[Signal] = []
        self.trace: list[TierTrace] = []
        self.coverage: float = 1.0
        self.elapsed_ms: float = 0.0
        self.faults: int = 0


async def run_detectors(ctx: CheckContext, budget_ms: float,
                        elevated: bool = False,
                        stage: str = "egress") -> ScheduleResult:
    """Run every detector that fits the budget, in parallel, per-detector timeout.

    Selection: all Tier 0 always; Tier 1 if its p95 estimate fits the budget;
    Tier 2 only when the episode is elevated AND the budget fits it.
    """
    res = ScheduleResult()
    dets = [d for d in all_detectors() if stage in d.stages]
    chosen: list[Detector] = []
    for d in dets:
        if d.tier == 0:
            chosen.append(d)
        elif d.tier == 1 and d.est_ms <= budget_ms:
            chosen.append(d)
        elif d.tier == 2 and elevated and d.est_ms <= budget_ms:
            chosen.append(d)
        else:
            res.trace.append(TierTrace(
                detector=d.name, tier=d.tier, ran=False,
                skipped_reason=("over latency budget" if d.tier == 1 or elevated
                                else "not elevated")))

    async def _run(d: Detector) -> tuple[Detector, list[Signal] | None, float, bool]:
        t0 = time.perf_counter()
        try:
            sigs = await asyncio.wait_for(d.check(ctx), timeout=max(budget_ms, 50) / 1000)
            return d, sigs, (time.perf_counter() - t0) * 1000, False
        except asyncio.TimeoutError:
            return d, None, (time.perf_counter() - t0) * 1000, True
        except Exception:
            return d, None, (time.perf_counter() - t0) * 1000, False

    t0 = time.perf_counter()
    results = await asyncio.gather(*(_run(d) for d in chosen))
    res.elapsed_ms = (time.perf_counter() - t0) * 1000

    total_w = sum(detector_weight(d) for d in dets) or 1.0
    got_w = 0.0
    for d, sigs, ms, timed_out in results:
        ok = sigs is not None
        res.trace.append(TierTrace(detector=d.name, tier=d.tier, ran=True,
                                   timed_out=timed_out, latency_ms=round(ms, 2)))
        if ok:
            res.signals.extend(sigs)
            got_w += detector_weight(d)
            # refresh the scheduler's latency estimate (EWMA towards measured)
            d.est_ms = 0.7 * d.est_ms + 0.3 * ms
        else:
            res.faults += 1
    res.coverage = round(got_w / total_w, 3)
    return res


async def warmup() -> dict[str, float]:
    """Eager-load and time every detector once at startup so the first real
    request never pays cold-start, and est_ms reflects THIS machine."""
    from .models import Source, SourceTrust
    ctx = CheckContext(
        user_text="What is the refund policy for order ORD-482913?",
        output_text=("The refund for order ORD-482913 of ₹4,250 was approved on "
                     "12 March 2026. Contact us at support@example.com."),
        sources=[Source(id="kb-1", text="Refunds for order ORD-482913 total ₹4,250, "
                                        "approved 12 March 2026.",
                        trust=SourceTrust.GOVERNED)],
        tokens_out=40)
    timings: dict[str, float] = {}
    for d in all_detectors():
        t0 = time.perf_counter()
        try:
            await d.check(ctx)
        except Exception:
            pass
        ms = (time.perf_counter() - t0) * 1000
        timings[d.name] = round(ms, 2)
        if d.tier > 0:
            d.est_ms = max(ms * 1.5, 0.5)  # p95-ish headroom over the warm run
    return timings

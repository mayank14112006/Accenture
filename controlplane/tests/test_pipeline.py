"""Scheduler + episode interaction: a slow detector is shed by its per-detector
timeout (coverage drops, faults recorded), and degraded coverage debits MORE
risk, never less — risk cannot be laundered through an overloaded checker."""
import asyncio

import pytest

from controlplane import scheduler
from controlplane.detectors.base import CheckContext, Detector
from controlplane.episode import EpisodeState
from controlplane.models import Signal
from controlplane.policy import PolicyPack


class FastTier0(Detector):
    name = "fake_fast_tier0"
    tier = 0
    stages = ["egress"]
    recall_weight = {"privacy": 0.5}

    async def check(self, ctx):
        return [Signal(detector=self.name, category="privacy", score=0.3)]


class SlowTier1(Detector):
    name = "fake_slow_tier1"
    tier = 1
    stages = ["egress"]
    est_ms = 1.0                       # lies about being fast, so it gets chosen
    recall_weight = {"grounding": 0.5}

    async def check(self, ctx):
        await asyncio.sleep(0.5)       # blows through the per-detector timeout
        return [Signal(detector=self.name, category="grounding", score=0.9)]


def test_slow_detector_sheds_on_timeout_and_coverage_drops(monkeypatch):
    monkeypatch.setattr(scheduler, "all_detectors", lambda: [FastTier0(), SlowTier1()])
    monkeypatch.setattr(scheduler, "_weights", {})   # use the fakes' own weights
    ctx = CheckContext(user_text="q", output_text="a")
    res = asyncio.run(scheduler.run_detectors(ctx, budget_ms=60))
    shed = {t.detector: t for t in res.trace}["fake_slow_tier1"]
    assert shed.ran and shed.timed_out
    assert res.faults == 1
    assert res.coverage == pytest.approx(0.5)        # half the recall weight ran
    # Tier 0's signal still arrived — Tier 0 never sheds
    assert [s.detector for s in res.signals] == ["fake_fast_tier0"]


def test_tier1_over_budget_is_skipped_not_run(monkeypatch):
    slow = SlowTier1()
    slow.est_ms = 10_000.0                           # honest estimate this time
    monkeypatch.setattr(scheduler, "all_detectors", lambda: [FastTier0(), slow])
    monkeypatch.setattr(scheduler, "_weights", {})
    ctx = CheckContext(user_text="q", output_text="a")
    res = asyncio.run(scheduler.run_detectors(ctx, budget_ms=60))
    skipped = {t.detector: t for t in res.trace}["fake_slow_tier1"]
    assert not skipped.ran
    assert skipped.skipped_reason == "over latency budget"
    assert res.coverage == pytest.approx(0.5)


def test_degraded_coverage_debits_more_risk():
    pack = PolicyPack(name="t", version=1, severities_inr={"grounding": 50_000},
                      correlated_clusters=[])
    full = EpisodeState("full", "t", "i1")
    degraded = EpisodeState("deg", "t", "i1")
    d_full = full.debit({"grounding": 0.2}, pack, coverage=1.0)
    d_degraded = degraded.debit({"grounding": 0.2}, pack, coverage=0.5)
    assert d_degraded > d_full
    assert degraded.hazard["grounding"] == pytest.approx(
        2 * full.hazard["grounding"])


def test_coverage_floor_stops_unbounded_surcharge():
    pack = PolicyPack(name="t", version=1, severities_inr={"grounding": 50_000},
                      correlated_clusters=[])
    ep_floor = EpisodeState("floor", "t", "i1")
    ep_tiny = EpisodeState("tiny", "t", "i1")
    ep_floor.debit({"grounding": 0.2}, pack, coverage=0.25)
    ep_tiny.debit({"grounding": 0.2}, pack, coverage=0.01)   # floored to 0.25
    assert ep_tiny.hazard["grounding"] == pytest.approx(ep_floor.hazard["grounding"])

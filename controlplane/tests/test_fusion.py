"""Risk-fusion math: calibration monotonicity, noisy-OR bounds, correlated-
cluster single-debit, prior-shift against hand-computed values."""
import math

import pytest

from controlplane import fusion
from controlplane.episode import EpisodeState
from controlplane.models import Signal
from controlplane.policy import PolicyPack


@pytest.fixture()
def isolated_calibration(monkeypatch):
    """Pin the calibration table so tests don't depend on evals/out state."""
    table = {"det_a": {"scores": [0.1, 0.4, 0.8], "probs": [0.05, 0.35, 0.9], "n": 100}}
    monkeypatch.setattr(fusion, "_calibration", table)
    return table


def test_calibrate_is_monotone_over_score_sweep(isolated_calibration):
    probs = [fusion.calibrate("det_a", s / 100) for s in range(0, 101)]
    assert all(b >= a for a, b in zip(probs, probs[1:]))
    assert 0.0 <= probs[0] and probs[-1] <= 1.0


def test_calibrate_unknown_detector_uses_shrunk_identity(isolated_calibration):
    assert fusion.calibrate("never_fitted", 0.6) == pytest.approx(0.6 * 0.85)
    assert fusion.calibrate("never_fitted", 0.0) == 0.0


def test_noisy_or_bounds(isolated_calibration, monkeypatch):
    sigs = [Signal(detector="det_a", category="grounding", score=0.4),
            Signal(detector="det_a", category="grounding", score=0.8)]
    (risk,) = [r for r in fusion.fuse(sigs, 0.03) if r.category == "grounding"]
    p1, p2 = fusion.calibrate("det_a", 0.4), fusion.calibrate("det_a", 0.8)
    # noisy-OR: at least as risky as the strongest signal, never past certainty,
    # and exactly 1 - (1-p1)(1-p2) for independent evidence
    assert risk.prob >= max(p1, p2)
    assert risk.prob <= min(1.0, p1 + p2)
    assert risk.prob == pytest.approx(1 - (1 - p1) * (1 - p2))


def test_annotate_only_signal_excluded_from_enforceable_prob(isolated_calibration):
    sigs = [Signal(detector="det_a", category="toxicity", score=0.8,
                   annotate_only=True)]
    (risk,) = [r for r in fusion.fuse(sigs, 0.03) if r.category == "toxicity"]
    assert risk.prob > 0
    assert risk.prob_enforce == 0.0


def test_prior_shift_hand_computed():
    # p=0.5, eval base rate 0.30, deployment base rate 0.03:
    # ratio = (0.03/0.30) * (0.70/0.97) = 0.0721649...
    # odds  = (0.5/0.5) * ratio -> p' = ratio / (1 + ratio) = 0.0673...
    expected = 0.0721649 / 1.0721649
    assert fusion.prior_shift(0.5, 0.30, 0.03) == pytest.approx(expected, abs=1e-4)
    # identity at the degenerate edges
    assert fusion.prior_shift(0.0, 0.30, 0.03) == 0.0
    assert fusion.prior_shift(1.0, 0.30, 0.03) == 1.0
    # same base rate -> no shift
    assert fusion.prior_shift(0.42, 0.30, 0.30) == pytest.approx(0.42)


def _pack(**kw):
    return PolicyPack(name="t", version=1,
                      severities_inr={"grounding": 10_000, "privacy": 10_000},
                      **kw)


def test_correlated_cluster_debits_once_at_max():
    ep = EpisodeState("e1", "t", "i1")
    pack = _pack(correlated_clusters=[["grounding", "privacy"]])
    ep.debit({"grounding": 0.5, "privacy": 0.4}, pack, coverage=1.0)
    assert ep.hazard["grounding"] == pytest.approx(-math.log(0.5))
    assert ep.hazard["privacy"] == 0.0     # same underlying event: one debit


def test_uncorrelated_categories_both_debit():
    ep = EpisodeState("e2", "t", "i1")
    pack = _pack(correlated_clusters=[])
    ep.debit({"grounding": 0.5, "privacy": 0.4}, pack, coverage=1.0)
    assert ep.hazard["grounding"] > 0
    assert ep.hazard["privacy"] > 0


def test_hazard_expected_loss_bounded_by_severity_sum():
    ep = EpisodeState("e3", "t", "i1")
    pack = _pack(correlated_clusters=[])
    for _ in range(50):   # naive summing would "accrue" far past the maximum
        ep.debit({"grounding": 0.6}, pack, coverage=1.0)
    assert ep.expected_loss(pack) <= sum(pack.severities_inr.values())
    assert ep.expected_loss(pack) == pytest.approx(pack.severity("grounding"), rel=1e-3)

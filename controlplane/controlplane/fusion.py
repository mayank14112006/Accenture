"""Risk fusion — fully specified, zero learned parameters at runtime.

Pipeline per category:
1. CALIBRATE each detector's raw score to P(real failure | score) via a
   piecewise-linear mapping fitted on the eval hold-out split
   (evals/out/calibration.json, produced by evals/run.py). Until an eval run
   exists, an identity-with-shrinkage default is used and the decision record
   marks calibration as "default".
2. PRIOR-SHIFT: eval traffic deliberately oversamples failures, so calibrated
   probabilities are rescaled to the pack's stated `assumed_base_rate` using
   the standard base-rate adjustment. The assumed rate is policy data — a
   stated, auditable assumption, recalibrated on real traffic in shadow phase.
3. COMBINE detectors within a category by noisy-OR (independent evidence of
   the same failure class).
Correlated categories (e.g. grounding+privacy firing on the same fabricated
person detail) are NOT summed downstream: the episode budget debits the max of
each declared cluster — both labels stay on the vector for reporting.
"""
from __future__ import annotations

import json
from pathlib import Path

from .config import settings
from .models import CategoryRisk, Signal, RISK_CATEGORIES

_calibration: dict | None = None
_calibration_source = "default"


def _load_calibration() -> dict:
    global _calibration, _calibration_source
    if _calibration is None:
        path = settings.evals_out_dir / "calibration.json"
        if path.exists():
            _calibration = json.loads(path.read_text())
            _calibration_source = "eval_holdout"
        else:
            _calibration = {}
    return _calibration


def calibration_source() -> str:
    _load_calibration()
    return _calibration_source


def calibrate(detector: str, score: float) -> float:
    """Piecewise-linear interpolation over fitted (score, precision) knots;
    identity-with-shrinkage (0.85x) when no fit exists for this detector."""
    table = _load_calibration().get(detector)
    if not table:
        return max(0.0, min(1.0, score * 0.85))
    xs, ys = table["scores"], table["probs"]
    if score <= xs[0]:
        # below the lowest observed knot: interpolate towards (0, 0) rather than
        # extrapolating the knot's precision to scores never seen at fit time
        return ys[0] * (score / xs[0]) if xs[0] > 0 else ys[0]
    for i in range(1, len(xs)):
        if score <= xs[i]:
            t = (score - xs[i - 1]) / (xs[i] - xs[i - 1] or 1e-9)
            return ys[i - 1] + t * (ys[i] - ys[i - 1])
    return ys[-1]


def prior_shift(p: float, eval_base_rate: float, deploy_base_rate: float) -> float:
    """Standard base-rate correction: detectors calibrated on failure-rich eval
    traffic over-estimate P(failure) on real traffic where failures are rare."""
    if p <= 0.0 or p >= 1.0 or eval_base_rate <= 0:
        return p
    ratio = (deploy_base_rate / eval_base_rate) * ((1 - eval_base_rate) / (1 - deploy_base_rate))
    odds = (p / (1 - p)) * ratio
    return odds / (1 + odds)


# Modelling constant for the injected-failure prevalence of the synthetic eval
# mix (measured 28.0% by construction; rounded to 0.30 — a stated assumption).
EVAL_BASE_RATE = 0.30


def fuse(signals: list[Signal], assumed_base_rate: float) -> list[CategoryRisk]:
    """Two probabilities per category, used for different purposes:
    - prob: fused CALIBRATED detection confidence -> decision thresholds
      (thresholds are tuned on the same eval distribution the calibration
      was fitted on, so this pairing is consistent);
    - prob_deployed: prior-shifted to the pack's assumed_base_rate -> the
      ₹ expected-loss debit (real traffic is failure-sparse; debiting with
      unshifted probs would overstate loss by the base-rate ratio)."""
    by_cat: dict[str, list[Signal]] = {}
    for s in signals:
        s.prob = calibrate(s.detector, s.score)
        by_cat.setdefault(s.category, []).append(s)
    out: list[CategoryRisk] = []
    for cat in RISK_CATEGORIES:
        sigs = by_cat.get(cat, [])
        if not sigs:
            out.append(CategoryRisk(category=cat))
            continue
        no_fail, no_fail_enforce = 1.0, 1.0
        for s in sigs:
            no_fail *= 1.0 - (s.prob or 0.0)
            if not s.annotate_only:
                no_fail_enforce *= 1.0 - (s.prob or 0.0)
        fused = 1.0 - no_fail
        out.append(CategoryRisk(
            category=cat, prob=fused,
            prob_deployed=prior_shift(fused, EVAL_BASE_RATE, assumed_base_rate),
            prob_enforce=1.0 - no_fail_enforce,
            detectors=sorted({s.detector for s in sigs}),
            evidence=[e for s in sigs for e in s.evidence][:8]))
    return out

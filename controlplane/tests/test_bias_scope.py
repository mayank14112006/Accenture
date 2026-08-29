"""Regression: the bias heuristic's annotate-only ceiling is STRUCTURAL.

A fitted calibration table may honestly map the bias signal's raw score to a
high precision (bias-seeded eval records are labelled positive) — that must
never promote a bias-only finding past ANNOTATE. The ceiling is enforced after
calibration via Signal.annotate_only -> CategoryRisk.prob_enforce, so this
holds regardless of what evals/out/calibration.json contains.
"""
import asyncio

from controlplane import fusion
from controlplane.decision import decide
from controlplane.detectors.base import CheckContext
from controlplane.detectors.tier1 import ToxicityLexicon
from controlplane.models import DecisionType
from controlplane.policy import PolicyPack, Thresholds


def _pack():
    return PolicyPack(
        name="t", version=1,
        thresholds={c: Thresholds(flag=0.4, block=0.75) for c in
                    ["grounding", "privacy", "toxicity", "injection", "cost"]})


def test_bias_only_output_never_blocks(monkeypatch):
    # worst case: calibration says this detector's every score means P(fail)=1.0
    monkeypatch.setattr(fusion, "calibrate", lambda det, score: 1.0)
    text = ("Elderly customers are always confused by basic technology, "
            "so keep the explanation simple.")
    sigs = asyncio.run(
        ToxicityLexicon().check(CheckContext(user_text="q", output_text=text)))
    assert sigs and all(s.annotate_only for s in sigs)
    risks = fusion.fuse(sigs, assumed_base_rate=0.03)
    tox = next(r for r in risks if r.category == "toxicity")
    assert tox.prob == 1.0            # calibration may say what it likes…
    assert tox.prob_enforce == 0.0    # …but nothing enforceable came from bias alone
    out = decide(risks, sigs, _pack(), text, None, False, False, faults=0)
    assert out.decision == DecisionType.ANNOTATE
    assert out.deliver


def test_real_toxicity_still_blocks(monkeypatch):
    monkeypatch.setattr(fusion, "calibrate", lambda det, score: min(1.0, score))
    text = "You are a pathetic, worthless idiot and I hate you."
    sigs = asyncio.run(
        ToxicityLexicon().check(CheckContext(user_text="q", output_text=text)))
    assert any(not s.annotate_only for s in sigs)
    risks = fusion.fuse(sigs, assumed_base_rate=0.03)
    out = decide(risks, sigs, _pack(), text, None, False, False, faults=0)
    assert out.decision == DecisionType.BLOCK

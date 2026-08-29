"""Tier 2 — LLM-as-judge. Expensive, so it runs ONLY when Tier 0/1 uncertainty
crosses the flag threshold or the episode is already elevated, and only when
the latency budget fits it. Goes through the same provider interface as the
upstream model (model-agnostic; in sim/replay mode the judge verdict is a
deterministic fixture so demos and evals are reproducible offline)."""
from __future__ import annotations

from ..models import Signal
from .base import CheckContext, Detector


class LlmJudge(Detector):
    name = "llm_judge"
    tier = 2
    categories = ["grounding", "toxicity", "privacy"]
    stages = ["egress"]
    est_ms = 450.0
    recall_weight = {"grounding": 0.30, "toxicity": 0.20, "privacy": 0.15}

    RUBRIC = (
        "You are a verification judge. Given SOURCES and a RESPONSE, answer with "
        "a JSON object {\"unsupported_claims\": [...], \"privacy_issue\": bool, "
        "\"toxicity_issue\": bool, \"confidence\": 0..1}. A claim is unsupported "
        "if it asserts a specific fact (number, date, name, event) not entailed "
        "by the sources. Do not judge style. Judge only verifiability."
    )

    def __init__(self, provider=None) -> None:
        self._provider = provider

    async def check(self, ctx: CheckContext) -> list[Signal]:
        if self._provider is None:
            from ..llm import get_provider
            self._provider = get_provider()
        verdict = await self._provider.judge(
            rubric=self.RUBRIC,
            sources=[s.text for s in ctx.sources],
            response=ctx.output_text,
        )
        signals: list[Signal] = []
        conf = float(verdict.get("confidence", 0.6))
        claims = verdict.get("unsupported_claims", [])
        if claims:
            signals.append(Signal(
                detector=self.name, category="grounding",
                score=min(1.0, 0.5 + 0.5 * conf),
                evidence=[f"judge: unsupported — {c[:80]}" for c in claims[:4]]))
        if verdict.get("privacy_issue"):
            signals.append(Signal(detector=self.name, category="privacy",
                                  score=0.7 * conf + 0.2,
                                  evidence=["judge: privacy issue"]))
        if verdict.get("toxicity_issue"):
            signals.append(Signal(detector=self.name, category="toxicity",
                                  score=0.7 * conf + 0.2,
                                  evidence=["judge: toxicity issue"]))
        return signals

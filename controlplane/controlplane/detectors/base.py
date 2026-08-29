"""Detector interface. Detectors are pluggable adapters: the governance layer
does not care whether a signal comes from a regex, a distilled model, or a
commercial guardrail vendor's API — bring your own detector."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from ..models import Signal, Source
from ..policy import PolicyPack


@dataclass
class CheckContext:
    user_text: str
    output_text: str
    sources: list[Source] = field(default_factory=list)
    pack: Optional[PolicyPack] = None
    stage: str = "egress"            # ingress | egress
    logprobs: Optional[list[float]] = None
    tokens_in: int = 0
    tokens_out: int = 0
    episode: Any = None


class Detector:
    name: str = "base"
    tier: int = 0
    categories: list[str] = []
    stages: list[str] = ["egress"]
    # p95 latency estimate used by the budget scheduler; refreshed by warmup
    est_ms: float = 1.0
    # marginal recall contribution per category (risk weights for the coverage
    # score); defaults are overwritten by evals/out/coverage_weights.json
    recall_weight: dict[str, float] = {}

    async def check(self, ctx: CheckContext) -> list[Signal]:  # pragma: no cover
        raise NotImplementedError

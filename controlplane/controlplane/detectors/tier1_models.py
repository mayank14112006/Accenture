"""OPTIONAL model-backed Tier-1 adapters (CP_DETECTOR_PROFILE=full).

These upgrade the lexical detectors to ONNX-int8 transformer inference when
`pip install -r requirements-models.txt` has been run. Latency is MEASURED at
warmup and fed to the budget scheduler — no hardcoded claims. The lite profile
never imports this module.

Model choices (small, CPU-viable, quantized):
- NLI:      cross-encoder/nli-MiniLM2-L6-H768 exported to ONNX int8
- Toxicity: unitary/toxic-bert exported to ONNX int8
Weights are downloaded once at first use and cached under ./data/models.
"""
from __future__ import annotations

import re

from ..config import settings
from ..models import Signal, SourceTrust
from .base import CheckContext, Detector

_NLI_MODEL = "cross-encoder/nli-MiniLM2-L6-H768"
_TOX_MODEL = "unitary/toxic-bert"


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if len(p.split()) >= 4]


class NliGroundingAdapter(Detector):
    name = "grounding_nli"
    tier = 1
    categories = ["grounding"]
    stages = ["egress"]
    est_ms = 60.0  # refreshed by warmup measurement
    recall_weight = {"grounding": 0.85}

    def __init__(self) -> None:
        from optimum.onnxruntime import ORTModelForSequenceClassification
        from transformers import AutoTokenizer
        cache = settings.data_dir / "models"
        self.tok = AutoTokenizer.from_pretrained(_NLI_MODEL, cache_dir=cache)
        self.model = ORTModelForSequenceClassification.from_pretrained(
            _NLI_MODEL, export=True, cache_dir=cache)
        # label order for this checkpoint: contradiction, entailment, neutral
        self.labels = ["contradiction", "entailment", "neutral"]

    async def check(self, ctx: CheckContext) -> list[Signal]:
        trusted = [s.text for s in ctx.sources if s.trust != SourceTrust.LOW_TRUST]
        if not trusted:
            return []
        premise = " ".join(trusted)[:2000]
        claims = _sentences(ctx.output_text)[:8]
        if not claims:
            return []
        import numpy as np
        enc = self.tok([premise] * len(claims), claims, truncation=True,
                       padding=True, max_length=256, return_tensors="np")
        logits = self.model(**enc).logits
        probs = np.exp(logits) / np.exp(logits).sum(-1, keepdims=True)
        ent_idx = self.labels.index("entailment")
        unsupported = [(c, float(1 - p[ent_idx])) for c, p in zip(claims, probs)
                       if p[ent_idx] < 0.35]
        if not unsupported:
            return []
        score = min(1.0, 0.5 + 0.5 * len(unsupported) / len(claims))
        return [Signal(detector=self.name, category="grounding", score=score,
                       evidence=[f"NLI not-entailed (p={p:.2f}): {c[:80]}"
                                 for c, p in unsupported[:4]])]


class TransformerToxicityAdapter(Detector):
    name = "toxicity_model"
    tier = 1
    categories = ["toxicity"]
    stages = ["egress"]
    est_ms = 40.0
    recall_weight = {"toxicity": 0.85}

    def __init__(self) -> None:
        from optimum.onnxruntime import ORTModelForSequenceClassification
        from transformers import AutoTokenizer
        cache = settings.data_dir / "models"
        self.tok = AutoTokenizer.from_pretrained(_TOX_MODEL, cache_dir=cache)
        self.model = ORTModelForSequenceClassification.from_pretrained(
            _TOX_MODEL, export=True, cache_dir=cache)

    async def check(self, ctx: CheckContext) -> list[Signal]:
        import numpy as np
        enc = self.tok([ctx.output_text[:1500]], truncation=True, padding=True,
                       max_length=384, return_tensors="np")
        logits = self.model(**enc).logits
        prob = float(1 / (1 + np.exp(-logits[0][0])))
        if prob < 0.3:
            return []
        return [Signal(detector=self.name, category="toxicity", score=prob,
                       evidence=[f"transformer toxicity p={prob:.2f}"])]

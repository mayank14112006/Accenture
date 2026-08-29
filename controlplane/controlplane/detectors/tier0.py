"""Tier 0 — deterministic checks, sub-millisecond, run on 100% of traffic and
on every buffered sentence during streaming. Never shed under load.

Honesty note (vs the Round-1 slide): NER-based PII detection does NOT fit a
<5ms deterministic tier — that was reviewed and corrected. Tier 0 carries only
regex/checksum detectors (which genuinely run in microseconds); name detection
lives in Tier 1 with its measured latency.
"""
from __future__ import annotations

import math
import re

from ..models import Signal
from .base import CheckContext, Detector

# ------------------------------------------------------------------ PII (regex/checksum)
_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}(?!\d)")
_PAN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
_AADHAAR = re.compile(r"(?<!\d)([2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4})(?!\d)")
_CARD = re.compile(r"(?<!\d)(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4})(?!\d)")
_IFSC = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")

_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]


def _verhoeff_ok(num: str) -> bool:
    """Aadhaar numbers carry a Verhoeff check digit."""
    c = 0
    for i, d in enumerate(reversed([int(x) for x in num])):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][d]]
    return c == 0


def _luhn_ok(num: str) -> bool:
    digits = [int(d) for d in num][::-1]
    total = sum(digits[0::2]) + sum(sum(divmod(2 * d, 10)) for d in digits[1::2])
    return total % 10 == 0 and 13 <= len(digits) <= 19


class PiiRegexDetector(Detector):
    name = "pii_regex"
    tier = 0
    categories = ["privacy"]
    stages = ["ingress", "egress"]
    est_ms = 0.5
    recall_weight = {"privacy": 0.55}

    async def check(self, ctx: CheckContext) -> list[Signal]:
        text = ctx.output_text if ctx.stage == "egress" else ctx.user_text
        hits: list[tuple[str, str, tuple[int, int]]] = []
        for m in _EMAIL.finditer(text):
            hits.append(("email", m.group(0), m.span()))
        for m in _PHONE.finditer(text):
            hits.append(("phone", m.group(0), m.span()))
        for m in _PAN.finditer(text):
            hits.append(("PAN", m.group(0), m.span()))
        for m in _AADHAAR.finditer(text):
            digits = re.sub(r"\D", "", m.group(1))
            if len(digits) == 12 and _verhoeff_ok(digits):
                hits.append(("Aadhaar", m.group(1), m.span(1)))
        for m in _CARD.finditer(text):
            digits = re.sub(r"\D", "", m.group(1))
            if _luhn_ok(digits):
                hits.append(("card", m.group(1), m.span(1)))
        for m in _IFSC.finditer(text):
            hits.append(("IFSC", m.group(0), m.span()))
        if not hits:
            return []
        score = min(1.0, 0.7 + 0.1 * len(hits))
        return [Signal(detector=self.name, category="privacy", score=score,
                       evidence=[f"{k}: {v[:4]}…" for k, v, _ in hits],
                       spans=[s for _, _, s in hits])]


class SecretsDetector(Detector):
    name = "secrets"
    tier = 0
    categories = ["privacy"]
    stages = ["egress"]
    est_ms = 0.3
    recall_weight = {"privacy": 0.10}

    _PATTERNS = [
        ("AWS key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
        ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
        ("private key", re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----")),
        ("API key-ish", re.compile(r"\b(?:sk|pk|api|key)[-_](?:live|test|prod)?[-_]?[A-Za-z0-9]{20,}\b")),
    ]

    async def check(self, ctx: CheckContext) -> list[Signal]:
        hits = []
        spans = []
        for label, rex in self._PATTERNS:
            for m in rex.finditer(ctx.output_text):
                hits.append(label)
                spans.append(m.span())
        if not hits:
            return []
        return [Signal(detector=self.name, category="privacy", score=0.95,
                       evidence=[f"credential material: {', '.join(hits)}"], spans=spans)]


# ------------------------------------------------------------------ injection
_INJECTION_SIGNATURES = [
    (r"ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?|rules)", 0.9),
    (r"disregard\s+(?:your|the)\s+(?:system\s+prompt|instructions|guidelines)", 0.9),
    (r"you\s+are\s+now\s+(?:DAN|in\s+developer\s+mode|jailbroken|unfiltered)", 0.95),
    (r"pretend\s+(?:you\s+have\s+no|there\s+are\s+no)\s+(?:restrictions|rules|guidelines)", 0.85),
    (r"reveal\s+(?:your|the)\s+(?:system\s+prompt|initial\s+instructions|hidden\s+rules)", 0.85),
    (r"(?:print|repeat|output)\s+(?:your|the)\s+(?:system|initial)\s+(?:prompt|message|instructions)", 0.85),
    (r"\bBEGIN\s+NEW\s+INSTRUCTIONS\b", 0.9),
    (r"<\s*(?:system|assistant)\s*>", 0.6),
    (r"\[\s*system\s*\]\s*:", 0.7),
    (r"do\s+anything\s+now", 0.7),
    (r"exfiltrat\w+|send\s+(?:this|the\s+data)\s+to\s+https?://", 0.8),
    (r"IMPORTANT:\s*(?:new\s+)?instructions?\s+(?:for|to)\s+(?:the\s+)?(?:AI|assistant|model)", 0.85),
    (r"when\s+(?:the\s+)?(?:AI|assistant|model)\s+reads\s+this", 0.85),
    (r"override\s+safety|bypass\s+(?:the\s+)?(?:filter|guard|checker)s?", 0.85),
    (r"base64:\s*[A-Za-z0-9+/=]{40,}", 0.5),
]
_INJECTION_RES = [(re.compile(p, re.IGNORECASE), w) for p, w in _INJECTION_SIGNATURES]


class InjectionDetector(Detector):
    """Runs at INGRESS on user input, on retrieved source documents (indirect
    injection — hostile content in loosely governed sources), and at egress
    (compliance echo: the model repeating an injected directive)."""
    name = "injection_sig"
    tier = 0
    categories = ["injection"]
    stages = ["ingress", "egress"]
    est_ms = 0.5
    recall_weight = {"injection": 0.85}

    async def check(self, ctx: CheckContext) -> list[Signal]:
        texts: list[tuple[str, str]] = []
        if ctx.stage == "ingress":
            texts.append(("user input", ctx.user_text))
            for s in ctx.sources:
                texts.append((f"source '{s.id}' ({s.trust.value})", s.text))
        else:
            texts.append(("model output", ctx.output_text))
        best, evidence = 0.0, []
        for label, text in texts:
            for rex, w in _INJECTION_RES:
                m = rex.search(text)
                if m:
                    best = max(best, w)
                    evidence.append(f"{label}: \"{m.group(0)[:60]}\"")
        if best == 0.0:
            return []
        return [Signal(detector=self.name, category="injection", score=best,
                       evidence=evidence[:5])]


# ------------------------------------------------------------------ cost
class CostMeter(Detector):
    name = "cost_meter"
    tier = 0
    categories = ["cost"]
    stages = ["egress"]
    est_ms = 0.1
    recall_weight = {"cost": 1.0}

    SOFT_TOKENS = 1200
    HARD_TOKENS = 4000

    async def check(self, ctx: CheckContext) -> list[Signal]:
        total = ctx.tokens_out
        # repetition loops burn tokens: flag heavy verbatim repetition
        words = ctx.output_text.split()
        rep = 0.0
        if len(words) > 60:
            tail = " ".join(words[-30:])
            body = " ".join(words[:-30])
            if tail and tail in body:
                rep = 0.9
        if total <= self.SOFT_TOKENS and rep == 0.0:
            return []
        over = max(0.0, min(1.0, (total - self.SOFT_TOKENS) / (self.HARD_TOKENS - self.SOFT_TOKENS)))
        score = max(over, rep)
        ev = []
        if over > 0:
            ev.append(f"{total} output tokens (soft limit {self.SOFT_TOKENS})")
        if rep > 0:
            ev.append("verbatim repetition loop detected")
        return [Signal(detector=self.name, category="cost", score=score, evidence=ev)]


# ------------------------------------------------------------------ entropy (opportunistic)
class LogprobEntropy(Detector):
    """OPPORTUNISTIC: only fires when the upstream provider returns token
    logprobs. Most enterprise APIs do not — availability is recorded in the
    model fingerprint and reflected in the coverage score, never substituted
    with a proxy (a local model's entropy measures the wrong distribution)."""
    name = "logprob_entropy"
    tier = 0
    categories = ["grounding"]
    stages = ["egress"]
    est_ms = 0.2
    recall_weight = {"grounding": 0.10}

    async def check(self, ctx: CheckContext) -> list[Signal]:
        if not ctx.logprobs:
            return []
        avg_nll = -sum(ctx.logprobs) / len(ctx.logprobs)
        # avg negative-log-likelihood ~0.1 (confident) .. ~2.5+ (very uncertain)
        score = max(0.0, min(1.0, (avg_nll - 0.8) / 1.7))
        if score < 0.15:
            return []
        return [Signal(detector=self.name, category="grounding", score=score,
                       evidence=[f"mean token NLL {avg_nll:.2f} (uncertain generation)"])]


TIER0: list[Detector] = [PiiRegexDetector(), SecretsDetector(), InjectionDetector(),
                         CostMeter(), LogprobEntropy()]

"""Tier 1 — heavier checks under the latency budget. The lite profile uses
deterministic lexical methods (no model downloads, runs anywhere); the full
profile upgrades grounding and toxicity to ONNX transformer adapters when
`requirements-models.txt` is installed (CP_DETECTOR_PROFILE=full).

Detectors are adapters by design: a client can replace any of these with a
commercial guardrail vendor's endpoint without touching the governance layer.
"""
from __future__ import annotations

import re

from ..canonical import extract_entities, numbers_match
from ..models import GroundingVerdict, Signal, SourceTrust
from .base import CheckContext, Detector

_STOP = set("""a an and are as at be but by for from has have i if in into is it its me my of on or
our so that the their them they this to was we were what when which who will with you your not no
can could should would may might do does did done how why all any been being over under about""".split())


def _content_tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOP and len(t) > 2}


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if len(p.split()) >= 4]


class GroundingLexical(Detector):
    """Unsupported-assertion detection — deliberately NOT 'fact checking'.
    A claim is checked for entailment-by-containment against registered
    sources + user input: canonical entities (numbers/dates/names/ids) must
    appear in a source, and content-token overlap must clear a floor.

    Verdicts per response:
      SUPPORTED / UNSUPPORTED  — sources exist, claims checked
      INSUFFICIENT_EVIDENCE    — no sources registered: the system ABSTAINS
                                 rather than inventing a verdict.
    Claims supported ONLY by low-trust sources are flagged with provenance.
    """
    name = "grounding_lexical"
    tier = 1
    categories = ["grounding"]
    stages = ["egress"]
    est_ms = 4.0
    recall_weight = {"grounding": 0.80}

    async def check(self, ctx: CheckContext) -> list[Signal]:
        if not ctx.output_text.strip():
            return []
        trusted = [s for s in ctx.sources if s.trust != SourceTrust.LOW_TRUST]
        low_trust = [s for s in ctx.sources if s.trust == SourceTrust.LOW_TRUST]
        if not ctx.sources:
            return [Signal(detector=self.name, category="grounding", score=0.0,
                           evidence=["INSUFFICIENT_EVIDENCE: no sources registered — abstaining"])]

        corpus_trusted = " \n ".join(s.text for s in trusted) + " \n " + ctx.user_text
        corpus_low = " \n ".join(s.text for s in low_trust)
        trusted_toks = _content_tokens(corpus_trusted)
        low_toks = _content_tokens(corpus_low)
        trusted_ents = extract_entities(corpus_trusted)
        low_ents = extract_entities(corpus_low)

        # ENTITY-ANCHORED scoring. Token-overlap alone punishes benign
        # paraphrase and boilerplate ("will reach your account in 5-7 days"),
        # drowning the real signal. So: a HARD fail is a canonical entity
        # (number/date/id/name) present in the claim but absent from every
        # source — the fabrication signature. Sentences with no entities and
        # low overlap are conversational filler, not claims: skipped, and
        # honestly OUT OF SCOPE for the lexical path (negation/recombination
        # cases belong to the NLI adapter / Tier-2 judge; stated in README).
        hard_claims, soft_claims, low_trust_only, spans = [], [], [], []
        entity_claims = 0
        for sent in _sentences(ctx.output_text):
            ents = [e for e in extract_entities(sent)
                    if not (e.kind == "name" and len(e.canonical) < 10)]
            if not ents:
                continue  # no verifiable anchor -> not a checkable claim
            entity_claims += 1
            hard, low_only = False, False
            for e in ents:
                if self._ent_in(e, trusted_ents):
                    continue
                if self._ent_in(e, low_ents):
                    low_only = True
                    continue
                if e.kind == "number" and e.value is not None:
                    from ..canonical import derivable
                    grounded_nums = [h.value for h in trusted_ents
                                     if h.kind == "number" and h.value is not None]
                    if derivable(e.value, grounded_nums):
                        continue  # derived-grounded, logged by the episode layer
                hard = True
            if hard:
                hard_claims.append(sent[:90])
                idx = ctx.output_text.find(sent)
                if idx >= 0:
                    spans.append((idx, idx + len(sent)))
            elif low_only:
                low_trust_only.append(sent[:60])
            else:
                toks = _content_tokens(sent)
                overlap_t = len(toks & trusted_toks) / len(toks) if toks else 1.0
                if overlap_t < 0.2:
                    soft_claims.append(sent[:90])

        signals: list[Signal] = []
        if hard_claims:
            frac = len(hard_claims) / max(entity_claims, 1)
            score = min(1.0, 0.7 + 0.3 * frac)
            signals.append(Signal(
                detector=self.name, category="grounding", score=score, spans=spans,
                evidence=[f"UNSUPPORTED entity claim ({len(hard_claims)}/{entity_claims}): " + u
                          for u in hard_claims[:4]]))
        elif soft_claims:
            signals.append(Signal(
                detector=self.name, category="grounding", score=0.35,
                evidence=[f"weak source overlap: {u}" for u in soft_claims[:3]]))
        if low_trust_only:
            signals.append(Signal(
                detector=self.name, category="grounding", score=0.55,
                evidence=[f"supported ONLY by low-trust source: {v}"
                          for v in low_trust_only[:4]]))
        return signals

    @staticmethod
    def _ent_in(e, ents) -> bool:
        for h in ents:
            if h.kind != e.kind:
                continue
            if e.kind == "number":
                if h.value is not None and e.value is not None and numbers_match(h.value, e.value):
                    return True
            elif h.canonical == e.canonical:
                return True
        return False


class PiiNameHeuristic(Detector):
    """Person-name detection with sensitive-context escalation. A name alone is
    weak PII; a name co-occurring with medical/financial/HR context is the
    brief's overlap case (fabricated detail about a person = hallucination AND
    privacy). Full profile can swap in spaCy NER via the same interface."""
    name = "pii_name_ctx"
    tier = 1
    categories = ["privacy"]
    stages = ["egress"]
    est_ms = 2.0
    recall_weight = {"privacy": 0.35}

    _SENSITIVE = re.compile(
        r"\b(diagnos\w+|treated|treatment|medication|HIV|cancer|diabet\w+|pregnan\w+|"
        r"salary|compensation|owes?|debt|default\w*|credit\s+score|loan|account\s+balance|"
        r"terminated|fired|disciplinary|performance\s+review|address|lives\s+at)\b",
        re.IGNORECASE)

    async def check(self, ctx: CheckContext) -> list[Signal]:
        ents = [e for e in extract_entities(ctx.output_text) if e.kind == "name"]
        if not ents:
            return []
        sensitive = bool(self._SENSITIVE.search(ctx.output_text))
        if not sensitive:
            return []
        # a person named in a sensitive context in the OUTPUT is a privacy event,
        # stronger when the name was volunteered by the model (not in user input)
        volunteered = [e for e in ents if e.display.lower() not in ctx.user_text.lower()]
        score = 0.75 if volunteered else 0.5
        return [Signal(detector=self.name, category="privacy", score=score,
                       spans=[(e.start, e.end) for e in ents],
                       evidence=[f"person '{e.display}' in sensitive context"
                                 for e in ents[:3]])]


class ToxicityLexicon(Detector):
    """Toxicity / harmful language via lexicon + patterns. Demographic-stereotype
    BIAS is a stated limitation of the lite profile: it is detected only via a
    demographic-term + generalisation heuristic whose score is CAPPED below
    every pack's block threshold — bias findings can ANNOTATE for human review,
    never BLOCK. (Toxicity benchmarks anchor toxicity; there is no honest
    off-the-shelf benchmark for subtle-stereotype classification.)"""
    name = "toxicity_lexicon"
    tier = 1
    categories = ["toxicity"]
    stages = ["egress"]
    est_ms = 1.0
    recall_weight = {"toxicity": 0.75}

    _TOXIC = re.compile(
        r"\b(idiot\w*|stupid|moron\w*|dumb|pathetic|worthless|shut\s+up|hate\s+you|"
        r"garbage\s+(?:person|people)|losers?\b|incompetent\s+fool|disgusting)\b",
        re.IGNORECASE)
    _THREAT = re.compile(
        r"\b(kill|hurt|destroy|ruin)\s+(?:you|him|her|them)\b", re.IGNORECASE)
    _DEMOGRAPHIC = re.compile(
        r"\b(women|men|muslims?|hindus?|christians?|sikhs?|dalits?|jews?|immigrants?|"
        r"north\s+indians?|south\s+indians?|elderly|old\s+people|young\s+people|"
        r"villagers?|rural\s+(?:people|folk)|urban\s+poor|disabled\s+(?:people|persons?))\b",
        re.IGNORECASE)
    _GENERALISATION = re.compile(
        r"\b(are\s+(?:all|always|never|naturally|inherently|too)|can'?t\s+(?:handle|do|manage)|"
        r"aren'?t\s+(?:suited|capable|fit)|tend\s+to\s+be\s+(?:too\s+)?(?:lazy|dishonest|emotional|weak|confused)|"
        r"don'?t\s+belong)\b", re.IGNORECASE)

    BIAS_CAP = 0.5  # annotate-only ceiling

    async def check(self, ctx: CheckContext) -> list[Signal]:
        text = ctx.output_text
        signals: list[Signal] = []
        tox_hits = self._TOXIC.findall(text)
        threat = self._THREAT.search(text)
        if tox_hits or threat:
            score = min(1.0, 0.55 + 0.15 * len(tox_hits) + (0.3 if threat else 0))
            ev = [f"toxic language: {', '.join(str(h) for h in tox_hits[:3])}"] if tox_hits else []
            if threat:
                ev.append(f"threatening phrase: \"{threat.group(0)}\"")
            signals.append(Signal(detector=self.name, category="toxicity",
                                  score=score, evidence=ev))
        demo = self._DEMOGRAPHIC.search(text)
        if demo:
            window = text[max(0, demo.start() - 80): demo.end() + 120]
            gen = self._GENERALISATION.search(window)
            if gen:
                signals.append(Signal(
                    detector=self.name, category="toxicity", score=self.BIAS_CAP,
                    annotate_only=True,  # structural ceiling — survives calibration
                    evidence=[f"bias heuristic (annotate-only): generalisation about "
                              f"'{demo.group(0)}' — \"…{window.strip()[:80]}…\""]))
        return signals


def load_tier1(profile: str = "lite") -> list[Detector]:
    dets: list[Detector] = [GroundingLexical(), PiiNameHeuristic(), ToxicityLexicon()]
    if profile == "full":
        try:
            from .tier1_models import NliGroundingAdapter, TransformerToxicityAdapter
            dets.append(NliGroundingAdapter())
            dets.append(TransformerToxicityAdapter())
        except Exception:
            pass  # models not installed -> lite set, reflected in coverage
    return dets

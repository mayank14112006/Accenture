"""Decision engine: risk vector × thresholds × mode × failure-mode → one action.

Severity order: BLOCK > ESCALATE > REPAIR > ANNOTATE > PASS.
HOLD_ACTION is produced by the action gate (episode.py), not here.

REPAIR is deterministic and LLM-free (so it survives every de-scope):
- privacy: mask the exact offending spans ([REDACTED:kind])
- grounding: hedge unsupported claims with an explicit uncertainty marker
One repair attempt max; the repaired text re-enters Tier-0; still dirty -> ESCALATE.

Failure mode of the checker itself is policy data:
- fail_open  (customer chat): deliver with a visible degraded-annotation, log it
- fail_closed (regulated):    never deliver unchecked content — BLOCK + escalate
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import CategoryRisk, DecisionType, GroundingVerdict, Signal
from .policy import PolicyPack

_REDACT_KIND = re.compile(r"^(email|phone|PAN|Aadhaar|card|IFSC)", re.IGNORECASE)


@dataclass
class Outcome:
    decision: DecisionType
    final_text: str
    annotations: list[str] = field(default_factory=list)
    repaired: bool = False
    repair_note: str | None = None
    failure_mode_applied: str | None = None
    deliver: bool = True     # False when the original must not reach the user


def _mask_spans(text: str, signals: list[Signal]) -> tuple[str, int]:
    spans: list[tuple[int, int]] = []
    for s in signals:
        if s.category == "privacy":
            spans.extend(s.spans)
    if not spans:
        return text, 0
    spans = sorted(set(spans), reverse=True)
    out = text
    for start, end in spans:
        out = out[:start] + "[REDACTED-PII]" + out[end:]
    return out, len(spans)


def _hedge_grounding(text: str, signals: list[Signal]) -> tuple[str, int]:
    spans: list[tuple[int, int]] = []
    for s in signals:
        if s.category == "grounding":
            spans.extend(s.spans)
    if not spans:
        return text, 0
    spans = sorted(set(spans), reverse=True)
    out = text
    for start, end in spans:
        claim = out[start:end].rstrip()
        hedged = f"[UNVERIFIED — not found in available sources: {claim}]"
        out = out[:start] + hedged + out[end:]
    return out, len(spans)


def decide(risks: list[CategoryRisk], signals: list[Signal], pack: PolicyPack,
           text: str, grounding_verdict: GroundingVerdict | None,
           budget_exhausted: bool, identity_exceeded: bool,
           faults: int) -> Outcome:
    out = Outcome(decision=DecisionType.PASS, final_text=text)

    # -- checker fault handling first (A4: induced fail-open) --------------
    if faults > 0:
        if pack.failure_mode == "fail_closed":
            out.decision = DecisionType.BLOCK
            out.deliver = False
            out.failure_mode_applied = "fail_closed"
            out.annotations.append(
                "checker degraded: failing closed per policy — response withheld, escalated")
            return out
        out.failure_mode_applied = "fail_open"
        out.annotations.append("checker degraded: delivered fail-open per policy (logged)")

    # -- abstention is a first-class annotation ----------------------------
    if grounding_verdict == GroundingVerdict.INSUFFICIENT_EVIDENCE:
        out.annotations.append(
            "INSUFFICIENT_EVIDENCE: no sources available to verify factual claims — "
            "verification abstained (not scored)")

    level = DecisionType.PASS
    repair_privacy = repair_grounding = False

    for r in risks:
        th = pack.threshold(r.category)
        # Block-level actions require ENFORCEABLE probability: annotate-only
        # signals (bias heuristic) are excluded here by construction, so a
        # fitted calibration table can never promote them past ANNOTATE.
        if r.prob_enforce >= th.block:
            if r.category == "privacy" and pack.redact_pii:
                repair_privacy = True
                level = _max(level, DecisionType.REPAIR)
            elif r.category == "grounding":
                if any(s.spans for s in signals if s.category == "grounding"):
                    repair_grounding = True
                    level = _max(level, DecisionType.REPAIR)
                else:
                    level = _max(level, DecisionType.ESCALATE)
            elif r.category == "cost":
                level = _max(level, DecisionType.ESCALATE)
            else:  # toxicity, injection
                level = _max(level, DecisionType.BLOCK)
            out.annotations.append(
                f"{r.category} p={r.prob_enforce:.2f} >= block({th.block}) via {'+'.join(r.detectors)}")
        elif r.prob >= th.flag:
            level = _max(level, DecisionType.ANNOTATE)
            ev = f" — {r.evidence[0]}" if r.evidence else ""
            out.annotations.append(
                f"{r.category} p={r.prob:.2f} flagged (threshold {th.flag}){ev}")

    # -- episode-level escalations -----------------------------------------
    if budget_exhausted:
        level = _max(level, DecisionType.ESCALATE)
        out.annotations.append(
            "episode expected-loss budget exhausted — no single response crossed a "
            "threshold, but cumulative risk did; escalating to human review")
    if identity_exceeded:
        level = _max(level, DecisionType.ESCALATE)
        out.annotations.append(
            "identity rolling risk window exceeded (budget-reset evasion guard)")

    # -- apply -------------------------------------------------------------
    if pack.mode == "audit":
        out.decision = level          # recorded verdict…
        out.final_text = text          # …but shadow mode never touches delivery
        out.annotations.append("audit mode: decision recorded, enforcement off")
        return out

    if level == DecisionType.REPAIR:
        repaired = text
        n = 0
        if repair_privacy:
            repaired, k = _mask_spans(repaired, signals)
            n += k
        if repair_grounding:
            repaired, k = _hedge_grounding(repaired, signals)
            n += k
        if n > 0:
            # re-entry check (one repair attempt max): repaired text must come
            # back clean through the Tier-0 PII pass, else escalate
            if repair_privacy and _residual_pii(repaired):
                out.decision = DecisionType.ESCALATE
                out.deliver = False
                out.annotations.append("repair re-check failed: residual PII — escalated")
            else:
                out.repaired = True
                out.repair_note = f"deterministic repair: {n} span(s) rewritten (1 attempt max)"
                out.final_text = repaired
                out.decision = DecisionType.REPAIR
        else:
            out.decision = DecisionType.ESCALATE
            out.deliver = False
        return out

    out.decision = level
    if level == DecisionType.BLOCK:
        out.deliver = False
        out.final_text = ("This response was withheld by the assurance layer "
                          "(policy: {}). A reviewer has been notified.".format(pack.name))
    elif level == DecisionType.ESCALATE:
        # escalate delivers nothing new to the user in gate mode; in inline mode
        # the annotated text is delivered while a reviewer is pulled in
        if pack.mode == "gate":
            out.deliver = False
            out.final_text = ("This response requires human review before release "
                              "(policy: {}).".format(pack.name))
    return out


def _residual_pii(text: str) -> bool:
    from .detectors.tier0 import _AADHAAR, _CARD, _EMAIL, _IFSC, _PAN, _PHONE
    return any(rex.search(text) for rex in (_EMAIL, _PHONE, _PAN, _AADHAAR, _CARD, _IFSC))


_ORDER = [DecisionType.PASS, DecisionType.ANNOTATE, DecisionType.REPAIR,
          DecisionType.ESCALATE, DecisionType.BLOCK]


def _max(a: DecisionType, b: DecisionType) -> DecisionType:
    return a if _ORDER.index(a) >= _ORDER.index(b) else b

"""Episode ledger: the layer no response-level guardrail has.

Three mechanisms:

1. EPISODE RISK BUDGET — cumulative-hazard math, not naive summing.
   Naively summing per-turn expected losses can exceed the worst possible loss
   (12 turns x P=0.15 x ₹50k "accrues" ₹90k against a ₹50k maximum). Instead we
   accumulate hazard per category:  h_c += -ln(1 - p_c)  which gives
   P(at least one real failure so far) = 1 - exp(-h_c), and
   expected loss = Σ_c (1 - exp(-h_c)) · severity_c  — monotone, interpretable,
   and bounded by Σ severities. Verbatim-restated outputs are deduped by content
   hash (a reworded restatement debits again; hazard convergence bounds the
   effect) — the taint layer additionally dedupes per canonical claim.
   Coverage surcharge: hazard is scaled by 1/coverage, so turns checked at
   degraded coverage debit MORE, not less (an attacker cannot launder risk
   through an overloaded checker).

2. CLAIM TAINT — canonical values (numbers/dates/ids/names) first appearing in
   model output with no support in trusted sources or user input are TAINTED.
   Values supported only by low-trust sources are LOW_TRUST. Values arithmetically
   derivable from grounded numbers are DERIVED (whitelisted, logged with formula).

3. ACTION GATE — evidence chain = {canonical entities in the tool-call args}
   UNION {unresolved tainted claims in the episode}. An IRREVERSIBLE action
   requires a taint-clear EPISODE, not merely taint-clear arguments: a pristine
   argument list resting on a fabricated premise is still held.

Identity-scoped rolling budgets sit above per-episode budgets so risk cannot be
laundered by splitting sessions (budget-reset evasion).
"""
from __future__ import annotations

import math
import time
from collections import defaultdict
from typing import Any, Optional

from .canonical import Entity, derivable, extract_entities, numbers_match
from .models import (ActionReversibility, ActionVerdict, ClaimRecord, ClaimStatus,
                     DecisionType, EvidenceLink, Source, SourceTrust)
from .policy import PolicyPack


class EpisodeState:
    def __init__(self, episode_id: str, use_case: str, identity: str) -> None:
        self.episode_id = episode_id
        self.use_case = use_case
        self.identity = identity
        self.created = time.time()
        self.turn = 0
        self.hazard: dict[str, float] = defaultdict(float)
        self.debited_hashes: set[str] = set()          # claim-dedupe for hazard
        self.claims: dict[str, ClaimRecord] = {}       # canonical -> record
        self.grounded_numbers: list[float] = []        # for derivation whitelist
        self.sources: list[Source] = []
        self.user_text: list[str] = []
        self.gate_events: list[dict] = []
        self.escalated = False
        self.decision_ids: list[str] = []

    # ---------------------------------------------------------- sources
    def add_sources(self, sources: list[Source]) -> None:
        self.sources.extend(sources)
        for s in sources:
            if s.trust != SourceTrust.LOW_TRUST:
                for e in extract_entities(s.text):
                    if e.kind == "number" and e.value is not None:
                        self.grounded_numbers.append(e.value)

    def add_user_text(self, text: str) -> None:
        self.user_text.append(text)
        for e in extract_entities(text):
            if e.kind == "number" and e.value is not None:
                self.grounded_numbers.append(e.value)

    # ---------------------------------------------------------- taint
    def _find_support(self, ent: Entity) -> tuple[Optional[str], Optional[SourceTrust]]:
        """Search user input and registered sources for this canonical value."""
        for txt in self.user_text:
            if self._contains(txt, ent):
                return "user", SourceTrust.GOVERNED
        best: tuple[Optional[str], Optional[SourceTrust]] = (None, None)
        for s in self.sources:
            if self._contains(s.text, ent):
                if s.trust != SourceTrust.LOW_TRUST:
                    return s.id, s.trust
                best = (s.id, s.trust)
        return best

    @staticmethod
    def _contains(haystack: str, ent: Entity) -> bool:
        for h in extract_entities(haystack):
            if h.kind != ent.kind:
                continue
            if ent.kind == "number":
                if h.value is not None and ent.value is not None and numbers_match(h.value, ent.value):
                    return True
            elif h.canonical == ent.canonical:
                return True
        return False

    def ingest_output(self, text: str, pack: PolicyPack) -> list[ClaimRecord]:
        """Extract canonical values from a model output; classify each as
        GROUNDED / DERIVED / LOW_TRUST / TAINTED. Returns newly tainted claims."""
        new_taints: list[ClaimRecord] = []
        for ent in extract_entities(text):
            if ent.canonical in self.claims:
                continue
            src, trust = self._find_support(ent)
            if src is not None and trust != SourceTrust.LOW_TRUST:
                rec = ClaimRecord(canonical=ent.canonical, display=ent.display,
                                  kind=ent.kind, status=ClaimStatus.GROUNDED,
                                  origin_turn=self.turn, grounded_in=src)
                if ent.kind == "number" and ent.value is not None:
                    self.grounded_numbers.append(ent.value)
            elif src is not None:  # only low-trust support
                status = ClaimStatus.LOW_TRUST if pack.low_trust_taints else ClaimStatus.GROUNDED
                rec = ClaimRecord(canonical=ent.canonical, display=ent.display,
                                  kind=ent.kind, status=status,
                                  origin_turn=self.turn, grounded_in=src)
                if status != ClaimStatus.GROUNDED:
                    new_taints.append(rec)
            else:
                formula = None
                if ent.kind == "number" and ent.value is not None:
                    formula = derivable(ent.value, self.grounded_numbers)
                if formula:
                    rec = ClaimRecord(canonical=ent.canonical, display=ent.display,
                                      kind=ent.kind, status=ClaimStatus.DERIVED,
                                      origin_turn=self.turn, grounded_in=f"derived: {formula}")
                else:
                    rec = ClaimRecord(canonical=ent.canonical, display=ent.display,
                                      kind=ent.kind, status=ClaimStatus.TAINTED,
                                      origin_turn=self.turn)
                    new_taints.append(rec)
            self.claims[ent.canonical] = rec
        return new_taints

    def unresolved_taints(self) -> list[ClaimRecord]:
        return [c for c in self.claims.values()
                if not c.resolved and c.status in (ClaimStatus.TAINTED, ClaimStatus.LOW_TRUST)]

    def resolve_claim(self, canonical: str) -> bool:
        rec = self.claims.get(canonical)
        if rec:
            rec.resolved = True
            return True
        return False

    # ---------------------------------------------------------- budget
    def debit(self, probs: dict[str, float], pack: PolicyPack, coverage: float,
              claim_hash: Optional[str] = None) -> float:
        """Accumulate hazard for passed-but-uncertain risk. Returns this turn's
        marginal expected-loss debit in INR."""
        if claim_hash and claim_hash in self.debited_hashes:
            return 0.0
        if claim_hash:
            self.debited_hashes.add(claim_hash)
        before = self.expected_loss(pack)
        cov = max(coverage, 0.25)
        # correlated clusters debit once at max prob (two labels, one debit)
        clustered: set[str] = set()
        for cluster in pack.correlated_clusters:
            live = [c for c in cluster if probs.get(c, 0.0) > 0]
            if len(live) > 1:
                top = max(live, key=lambda c: probs[c])
                clustered.update(c for c in live if c != top)
        for cat, p in probs.items():
            if cat in clustered:
                continue
            p = min(max(p, 0.0), 0.995)
            if p <= 0:
                continue
            self.hazard[cat] += -math.log(1.0 - p) / cov
        return self.expected_loss(pack) - before

    def expected_loss(self, pack: PolicyPack) -> float:
        return sum((1.0 - math.exp(-h)) * pack.severity(cat)
                   for cat, h in self.hazard.items())

    def budget_exhausted(self, pack: PolicyPack) -> bool:
        return self.expected_loss(pack) >= pack.episode_budget_inr

    # ---------------------------------------------------------- action gate
    def gate_action(self, tool: str, args: dict[str, Any], pack: PolicyPack) -> ActionVerdict:
        reversibility = ActionReversibility(
            pack.tools.get(tool, ActionReversibility.REVERSIBLE.value))
        chain: list[EvidenceLink] = []
        arg_taints: list[ClaimRecord] = []
        flat = _flatten(args)
        for ent in extract_entities(flat):
            rec = self._match_claim(ent)
            link = EvidenceLink(value=ent.display, canonical=ent.canonical)
            if rec:
                link.origin_turn = rec.origin_turn
                link.grounded_in = rec.grounded_in
                link.status = rec.status
                if not rec.resolved and rec.status in (ClaimStatus.TAINTED, ClaimStatus.LOW_TRUST):
                    arg_taints.append(rec)
            else:
                src, trust = self._find_support(ent)
                if src:
                    link.grounded_in = src
                    link.status = (ClaimStatus.LOW_TRUST
                                   if trust == SourceTrust.LOW_TRUST else ClaimStatus.GROUNDED)
                else:
                    link.status = None  # unknown to the episode: not model-originated
            chain.append(link)

        episode_taints = self.unresolved_taints()
        held, reason = False, "clean evidence chain"
        if reversibility == ActionReversibility.IRREVERSIBLE:
            if arg_taints:
                held = True
                reason = (f"argument contains tainted claim(s): "
                          f"{', '.join(t.display for t in arg_taints)} "
                          f"(first appeared turn {arg_taints[0].origin_turn}, ungrounded)")
            elif episode_taints and pack.irreversible_requires == "grounded":
                held = True
                reason = (f"episode is not taint-clear: {len(episode_taints)} unresolved "
                          f"ungrounded claim(s), e.g. '{episode_taints[0].display}' from turn "
                          f"{episode_taints[0].origin_turn} — irreversible actions require a "
                          f"clean episode, not just clean arguments")
            elif self.escalated:
                held = True
                reason = "episode risk budget exhausted — human review required first"
        verdict = ActionVerdict(
            decision=DecisionType.HOLD_ACTION if held else DecisionType.PASS,
            tool=tool, reversibility=reversibility,
            evidence_chain=chain, unresolved_taints=episode_taints, reason=reason)
        self.gate_events.append({
            "ts": time.time(), "turn": self.turn, "tool": tool,
            "decision": verdict.decision.value, "reason": reason,
        })
        return verdict

    def _match_claim(self, ent: Entity) -> Optional[ClaimRecord]:
        rec = self.claims.get(ent.canonical)
        if rec:
            return rec
        if ent.kind == "number" and ent.value is not None:
            for c in self.claims.values():
                if c.kind == "number":
                    try:
                        if numbers_match(float(c.canonical.split(":", 1)[1]), ent.value):
                            return c
                    except ValueError:
                        continue
        return None


def _flatten(obj: Any) -> str:
    if isinstance(obj, dict):
        return " ".join(f"{k} {_flatten(v)}" for k, v in obj.items())
    if isinstance(obj, (list, tuple)):
        return " ".join(_flatten(v) for v in obj)
    return str(obj)


class EpisodeStore:
    """In-memory episode registry + identity-scoped rolling expected-loss windows."""

    def __init__(self) -> None:
        self.episodes: dict[str, EpisodeState] = {}
        self.identity_ledger: dict[str, list[tuple[float, float]]] = defaultdict(list)

    def get(self, episode_id: str, use_case: str, identity: str) -> EpisodeState:
        ep = self.episodes.get(episode_id)
        if ep is None:
            ep = EpisodeState(episode_id, use_case, identity)
            self.episodes[episode_id] = ep
        return ep

    def record_identity_loss(self, identity: str, inr: float) -> None:
        if inr > 0:
            self.identity_ledger[identity].append((time.time(), inr))

    def identity_window_total(self, identity: str, window_hours: float) -> float:
        cutoff = time.time() - window_hours * 3600
        entries = [(t, v) for t, v in self.identity_ledger[identity] if t >= cutoff]
        self.identity_ledger[identity] = entries
        return sum(v for _, v in entries)


episodes = EpisodeStore()

"""The end-to-end check pipeline shared by the streaming and non-streaming
paths and by the eval harness (which calls it in-process)."""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from .config import settings
from .decision import Outcome, decide
from .detectors.base import CheckContext
from .episode import EpisodeState, episodes
from .fusion import calibration_source, fuse
from .ledger import ledger
from .models import (ActionVerdict, CategoryRisk, Decision, DecisionType,
                     GroundingVerdict, Source, SourceTrust)
from .policy import LoadedPack, PolicyEngine
from .scheduler import run_detectors
from .telemetry import telemetry

policy_engine: PolicyEngine | None = None


def get_policy_engine() -> PolicyEngine:
    global policy_engine
    if policy_engine is None:
        policy_engine = PolicyEngine()
    return policy_engine


@dataclass
class RequestEnvelope:
    use_case: str
    episode_id: str
    identity: str
    user_text: str
    sources: list[Source] = field(default_factory=list)
    cp_sim: Optional[dict] = None
    messages: list[dict] = field(default_factory=list)


@dataclass
class PipelineResult:
    decision: Decision
    outcome: Outcome
    action_verdicts: list[ActionVerdict] = field(default_factory=list)
    ingress_blocked: bool = False


def _grounding_verdict(risks: list[CategoryRisk], sources: list[Source],
                       signals) -> GroundingVerdict:
    if not sources:
        return GroundingVerdict.INSUFFICIENT_EVIDENCE
    g = next((r for r in risks if r.category == "grounding"), None)
    if g and g.prob >= 0.45:
        return GroundingVerdict.UNSUPPORTED
    if any("derived" in (e or "") for s in signals for e in s.evidence):
        return GroundingVerdict.DERIVED
    return GroundingVerdict.SUPPORTED


async def run_ingress(env: RequestEnvelope, lp: LoadedPack) -> tuple[bool, list[str], float]:
    """Pre-model gate: injection / input-PII / policy pre-checks on the user
    input AND on retrieved sources (indirect injection). Returns
    (blocked, annotations, elapsed_ms)."""
    ctx = CheckContext(user_text=env.user_text, output_text="",
                       sources=env.sources, pack=lp.pack, stage="ingress")
    res = await run_detectors(ctx, lp.pack.latency_budget_ms, stage="ingress")
    risks = fuse(res.signals, lp.pack.assumed_base_rate)
    notes: list[str] = []
    blocked = False
    for r in risks:
        th = lp.pack.threshold(r.category)
        if r.category == "injection" and r.prob >= th.block:
            blocked = lp.pack.mode != "audit"
            notes.append(f"INGRESS: injection p={r.prob:.2f} >= block({th.block}) — "
                         + (r.evidence[0] if r.evidence else ""))
        elif r.prob >= th.flag and r.prob > 0:
            notes.append(f"INGRESS: {r.category} p={r.prob:.2f} flagged in input")
    return blocked, notes, res.elapsed_ms


async def run_egress(env: RequestEnvelope, lp: LoadedPack, output_text: str,
                     tool_calls: list[dict], logprobs, tokens_in: int,
                     tokens_out: int, fingerprint: str,
                     model_ms: float = 0.0) -> PipelineResult:
    t0 = time.perf_counter()
    pack = lp.pack
    ep = episodes.get(env.episode_id, env.use_case, env.identity)
    ep.turn += 1
    ep.add_user_text(env.user_text)
    ep.add_sources(env.sources)

    elevated = ep.expected_loss(pack) >= 0.5 * pack.episode_budget_inr or ep.escalated
    ctx = CheckContext(user_text=env.user_text, output_text=output_text,
                       sources=ep.sources, pack=pack, stage="egress",
                       logprobs=logprobs, tokens_in=tokens_in, tokens_out=tokens_out,
                       episode=ep)
    res = await run_detectors(ctx, pack.latency_budget_ms, elevated=elevated)
    risks = fuse(res.signals, pack.assumed_base_rate)
    verdict = _grounding_verdict(risks, ep.sources, res.signals)

    # taint ingest BEFORE gating any tool call in this same turn
    new_taints = ep.ingest_output(output_text, pack)

    # budget debit: passed-but-uncertain risk (prob_deployed below block), deduped
    # by content hash so restating the same output doesn't double-debit
    debit_probs = {}
    for r in risks:
        th = pack.threshold(r.category)
        if 0.0 < r.prob < th.block:
            debit_probs[r.category] = r.prob_deployed
    claim_hash = hashlib.sha256(output_text.strip().lower().encode()).hexdigest()
    debit = ep.debit(debit_probs, pack, res.coverage, claim_hash=claim_hash)
    episodes.record_identity_loss(env.identity, debit)
    identity_total = episodes.identity_window_total(
        env.identity, pack.identity_window.window_hours)
    identity_exceeded = identity_total > pack.identity_window.limit_inr
    exhausted = ep.budget_exhausted(pack)
    if exhausted:
        ep.escalated = True

    outcome = decide(risks, res.signals, pack, output_text, verdict,
                     exhausted, identity_exceeded, res.faults)
    if new_taints and pack.mode != "audit":
        outcome.annotations.append(
            "provenance: " + "; ".join(
                f"'{t.display}' ({t.status.value}, turn {t.origin_turn})"
                for t in new_taints[:4]))

    # ---- action gate: evidence chain inspected BEFORE execution ----------
    action_verdicts: list[ActionVerdict] = []
    for tc in tool_calls:
        tool = tc.get("name") or tc.get("function", {}).get("name", "unknown")
        args = tc.get("arguments") or tc.get("function", {}).get("arguments", {})
        if isinstance(args, str):
            import json as _json
            try:
                args = _json.loads(args)
            except Exception:
                args = {"raw": args}
        av = ep.gate_action(tool, args, pack)
        if pack.mode == "audit" and av.decision == DecisionType.HOLD_ACTION:
            av.reason += " [audit mode: would have held — logged only]"
        action_verdicts.append(av)

    held = [a for a in action_verdicts
            if a.decision == DecisionType.HOLD_ACTION and pack.mode != "audit"]
    final_decision = outcome.decision
    if held:
        final_decision = DecisionType.HOLD_ACTION
        telemetry.gate_holds += len(held)

    # ---- economics & telemetry -------------------------------------------
    model_cost = (tokens_in + tokens_out) / 1000 * settings.MODEL_COST_PER_1K_TOKENS_INR
    tier2_ran = sum(1 for t in res.trace if t.ran and t.tier == 2)
    detector_cpu_ms = sum(t.latency_ms for t in res.trace if t.ran)
    assurance_cost = (detector_cpu_ms / 3_600_000 * settings.CPU_RATE_INR_PER_HOUR
                      + tier2_ran * settings.TIER2_JUDGE_COST_INR)
    top_cat = max(risks, key=lambda r: r.prob)
    if final_decision in (DecisionType.BLOCK, DecisionType.REPAIR,
                          DecisionType.HOLD_ACTION) or (
            final_decision == DecisionType.ESCALATE and not outcome.deliver):
        telemetry.avoided_loss_inr += pack.severity(top_cat.category)
    telemetry.decisions[final_decision.value] += 1
    telemetry.by_use_case[env.use_case][final_decision.value] += 1
    telemetry.coverage.add(res.coverage)
    telemetry.tokens_in += tokens_in
    telemetry.tokens_out += tokens_out
    telemetry.model_calls += 1
    telemetry.judge_calls += tier2_ran
    telemetry.model_cost_inr += model_cost
    telemetry.assurance_cost_inr += assurance_cost
    telemetry.non_llm_checks += sum(1 for t in res.trace if t.ran and t.tier < 2)
    telemetry.llm_checks += tier2_ran
    if outcome.repaired:
        telemetry.repair_count += 1
    if final_decision == DecisionType.ESCALATE:
        telemetry.escalations += 1
    if res.faults or outcome.failure_mode_applied:
        telemetry.degraded_requests += 1
    for t in res.trace:
        if t.ran:
            telemetry.detector_ms[t.detector].add(t.latency_ms)

    added_ms = (time.perf_counter() - t0) * 1000
    telemetry.added_latency.add(added_ms)

    # correlated clusters actually active this turn (for the record)
    active_clusters = []
    for cluster in pack.correlated_clusters:
        live = [c for c in cluster
                if any(r.category == c and r.prob > 0 for r in risks)]
        if len(live) > 1:
            active_clusters.append(live)

    dec = Decision(
        episode_id=env.episode_id, turn=ep.turn, use_case=env.use_case,
        decision=final_decision, risk=risks, grounding_verdict=verdict,
        correlated_labels=active_clusters,
        coverage=res.coverage, tier_trace=res.trace,
        annotations=outcome.annotations, repaired=outcome.repaired,
        repair_note=outcome.repair_note,
        degraded=bool(res.faults or outcome.failure_mode_applied),
        failure_mode_applied=outcome.failure_mode_applied,
        policy_name=pack.name, policy_version=pack.version,
        pack_hash=lp.pack_hash, mode=pack.mode,
        debit_inr=round(debit, 2),
        expected_loss_inr=round(ep.expected_loss(pack), 2),
        budget_inr=pack.episode_budget_inr, budget_exhausted=exhausted,
        latency_ms=round(added_ms, 2), tokens_in=tokens_in, tokens_out=tokens_out,
        assurance_cost_inr=round(assurance_cost, 4),
        model_cost_inr=round(model_cost, 4),
        model_fingerprint=fingerprint + f" calibration={calibration_source()}")

    entry_hash = await ledger.append(
        kind="decision",
        payload={
            "decision": final_decision.value, "use_case": env.use_case,
            "turn": ep.turn,
            "risk": {r.category: round(r.prob, 3) for r in risks if r.prob > 0},
            "coverage": res.coverage, "policy": f"{pack.name}@v{pack.version}",
            "pack_hash": lp.pack_hash[:16], "mode": pack.mode,
            "debit_inr": round(debit, 2),
            "expected_loss_inr": round(ep.expected_loss(pack), 2),
            "grounding": verdict.value if verdict else None,
            "gate": [{"tool": a.tool, "decision": a.decision.value}
                     for a in action_verdicts],
            "fingerprint": fingerprint,
        },
        episode_id=env.episode_id, decision_id=dec.id, raw_content=output_text)
    dec.ledger_hash = entry_hash
    ep.decision_ids.append(dec.id)

    _recent_decisions.append(dec)
    if len(_recent_decisions) > 500:
        del _recent_decisions[:100]
    _decision_index[dec.id] = dec

    return PipelineResult(decision=dec, outcome=outcome,
                          action_verdicts=action_verdicts)


_recent_decisions: list[Decision] = []
_decision_index: dict[str, Decision] = {}


def recent_decisions(limit: int = 50) -> list[Decision]:
    return list(reversed(_recent_decisions[-limit:]))


def get_decision(decision_id: str) -> Decision | None:
    return _decision_index.get(decision_id)

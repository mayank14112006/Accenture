"""Episode budget math, taint propagation, action gate."""
import math

from controlplane.episode import EpisodeState
from controlplane.models import ClaimStatus, DecisionType, Source, SourceTrust
from controlplane.policy import PolicyPack, Thresholds


def _pack(**kw):
    defaults = dict(
        name="t", version=1,
        thresholds={c: Thresholds(flag=0.4, block=0.8) for c in
                    ["grounding", "privacy", "toxicity", "injection", "cost"]},
        severities_inr={"grounding": 50_000, "privacy": 100_000},
        episode_budget_inr=60_000,
        tools={"issue_refund": "irreversible", "lookup": "reversible"},
    )
    defaults.update(kw)
    return PolicyPack(**defaults)


def test_expected_loss_bounded_by_worst_case():
    """The review kill-shot: 12 turns x P=0.15 must NOT accrue more than the
    maximum possible loss. Hazard math keeps it bounded."""
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    for _ in range(12):
        ep.debit({"grounding": 0.15}, pack, coverage=1.0)
    assert ep.expected_loss(pack) < 50_000  # < severity, never 90k


def test_repeated_claim_dedupe():
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.debit({"grounding": 0.3}, pack, coverage=1.0, claim_hash="h1")
    before = ep.expected_loss(pack)
    ep.debit({"grounding": 0.3}, pack, coverage=1.0, claim_hash="h1")  # restated
    assert ep.expected_loss(pack) == before


def test_degraded_coverage_debits_more_not_less():
    ep_full = EpisodeState("e1", "t", "u")
    ep_deg = EpisodeState("e2", "t", "u")
    pack = _pack()
    ep_full.debit({"grounding": 0.2}, pack, coverage=1.0)
    ep_deg.debit({"grounding": 0.2}, pack, coverage=0.5)
    assert ep_deg.expected_loss(pack) > ep_full.expected_loss(pack)


def test_correlated_cluster_debits_once():
    """Brief's overlap case: fabricated detail about a person fires grounding
    AND privacy — one failure, one debit (at the max), both labels recorded."""
    ep = EpisodeState("e1", "t", "u")
    pack = _pack(correlated_clusters=[["grounding", "privacy"]])
    ep.debit({"grounding": 0.3, "privacy": 0.25}, pack, coverage=1.0)
    assert ep.hazard["grounding"] > 0
    assert ep.hazard["privacy"] == 0  # lower-prob cluster member not double-charged


def test_taint_rephrased_value_still_gated():
    """Turn 1: model fabricates '₹85,000'. Turn 2: tool call carries 85000 as a
    digit — and would also match 'eighty-five thousand'."""
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.turn = 1
    ep.add_sources([Source(id="kb", text="Approved claim value ₹45,000.",
                           trust=SourceTrust.GOVERNED)])
    taints = ep.ingest_output("The approved amount is eighty-five thousand rupees.", pack)
    assert any(t.status == ClaimStatus.TAINTED for t in taints)
    ep.turn = 2
    v = ep.gate_action("issue_refund", {"amount": 85000}, pack)
    assert v.decision == DecisionType.HOLD_ACTION
    assert "tainted" in v.reason


def test_clean_args_tainted_premise_still_held():
    """The dominant failure the naive gate misses: arguments are pristine, but
    the DECISION rests on a fabricated premise elsewhere in the episode."""
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.turn = 1
    ep.add_user_text("Process claim CLM-1001 for the approved amount of ₹45,000")
    ep.add_sources([Source(id="kb", text="Claim CLM-1001 approved for ₹45,000.",
                           trust=SourceTrust.GOVERNED)])
    ep.ingest_output("The customer's balance fully covers this, at ₹9,90,000.", pack)
    assert ep.unresolved_taints()
    ep.turn = 2
    v = ep.gate_action("issue_refund", {"claim": "CLM-1001", "amount": 45000}, pack)
    assert v.decision == DecisionType.HOLD_ACTION
    assert "not taint-clear" in v.reason


def test_derived_value_not_tainted():
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.add_sources([Source(id="kb", text="Base fare ₹40,000. Service fee ₹5,000.",
                           trust=SourceTrust.GOVERNED)])
    taints = ep.ingest_output("Your total comes to ₹45,000.", pack)
    assert not taints
    assert ep.claims["num:45000"].status == ClaimStatus.DERIVED


def test_low_trust_source_taints():
    """MemGhost / loosely-governed-source case: supported only by an email."""
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.add_sources([Source(id="email-1", text="Vendor says the payout should be ₹77,000.",
                           trust=SourceTrust.LOW_TRUST)])
    taints = ep.ingest_output("The payout is ₹77,000.", pack)
    assert taints and taints[0].status == ClaimStatus.LOW_TRUST
    v = ep.gate_action("issue_refund", {"amount": 77000}, pack)
    assert v.decision == DecisionType.HOLD_ACTION


def test_reversible_action_passes_despite_taint():
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.ingest_output("Fabricated figure ₹99,999 with no sources.", pack)
    v = ep.gate_action("lookup", {"q": "records"}, pack)
    assert v.decision == DecisionType.PASS


def test_resolved_claim_clears_gate():
    ep = EpisodeState("e1", "t", "u")
    pack = _pack()
    ep.ingest_output("Confirmed amount is ₹85,000.", pack)
    assert ep.unresolved_taints()
    ep.resolve_claim("num:85000")
    v = ep.gate_action("issue_refund", {"amount": 85000}, pack)
    assert v.decision == DecisionType.PASS

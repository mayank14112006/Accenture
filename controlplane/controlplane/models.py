"""Shared data models for the ControlPlane pipeline.

Risk taxonomy (multi-label): grounding, privacy, toxicity, injection, cost.
"bias" is deliberately NOT a standalone benchmarked axis: demographic-stereotype
detection is handled as a heuristic sub-signal of `toxicity` that can only ever
ANNOTATE, never BLOCK (see detectors/tier1_toxicity.py). This scoping is stated
in the README.
"""
from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

RISK_CATEGORIES = ["grounding", "privacy", "toxicity", "injection", "cost"]


class DecisionType(str, Enum):
    PASS = "PASS"
    ANNOTATE = "ANNOTATE"
    REPAIR = "REPAIR"
    ESCALATE = "ESCALATE"
    BLOCK = "BLOCK"
    HOLD_ACTION = "HOLD_ACTION"


class GroundingVerdict(str, Enum):
    SUPPORTED = "SUPPORTED"
    UNSUPPORTED = "UNSUPPORTED"
    DERIVED = "DERIVED"                    # arithmetically derivable from grounded values
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"  # abstention: no sources to check against


class SourceTrust(str, Enum):
    """Governance quality of a data source feeding the model (brief: 'mix of
    well-governed and loosely governed internal data sources')."""
    GOVERNED = "governed"      # curated KB, ground-truth grade
    INTERNAL = "internal"      # normal internal docs
    LOW_TRUST = "low_trust"    # shared drives, email, agent memory, web


class Source(BaseModel):
    id: str
    text: str
    trust: SourceTrust = SourceTrust.INTERNAL


class Signal(BaseModel):
    """One detector's finding on one category."""
    detector: str
    category: str
    score: float = Field(ge=0.0, le=1.0)      # raw detector score
    prob: Optional[float] = None              # calibrated P(real failure), filled by fusion
    evidence: list[str] = []                  # human-readable evidence spans/notes
    spans: list[tuple[int, int]] = []         # char offsets in the checked text (for REPAIR)
    latency_ms: float = 0.0
    # Structural annotate-only ceiling: signals marked True can raise a decision
    # to ANNOTATE at most, never to BLOCK/ESCALATE — enforced in fusion+decision,
    # AFTER calibration, so a fitted calibration table cannot override the scope
    # (used by the bias heuristic, whose honest limit is "flag for human review").
    annotate_only: bool = False


class CategoryRisk(BaseModel):
    category: str
    # Fused calibrated detection confidence (P(real failure | detector scores),
    # fitted on the eval hold-out). Decision thresholds operate on THIS.
    prob: float = 0.0
    # The same probability rescaled to the pack's assumed deployment base rate
    # (eval traffic oversamples failures). The ₹ budget debit uses THIS, so the
    # expected-loss ledger never overstates real-world loss.
    prob_deployed: float = 0.0
    # Fused probability over ENFORCEABLE signals only (annotate_only excluded).
    # Block/escalate decisions use THIS — an annotate-only heuristic can never
    # block, regardless of what calibration says about its precision.
    prob_enforce: float = 0.0
    detectors: list[str] = []
    evidence: list[str] = []


class TierTrace(BaseModel):
    detector: str
    tier: int
    ran: bool
    timed_out: bool = False
    latency_ms: float = 0.0
    skipped_reason: Optional[str] = None


class ClaimStatus(str, Enum):
    GROUNDED = "grounded"          # found in governed/internal source or user input
    DERIVED = "derived"            # computed from grounded values (whitelisted derivation)
    LOW_TRUST = "low_trust"        # only support is a low-trust source
    TAINTED = "tainted"            # no support anywhere: first appeared in model output


class ClaimRecord(BaseModel):
    """A canonical value (number / date / identifier / name) tracked across an episode."""
    canonical: str                 # canonical form, e.g. "num:120000", "date:2026-03-04"
    display: str                   # as it appeared, e.g. "₹1.2 lakh"
    kind: str                      # number | date | id | name | email | phone
    status: ClaimStatus
    origin_turn: int
    grounded_in: Optional[str] = None   # source id / "user" / derivation formula
    resolved: bool = False              # a human confirmed it, clearing the taint


class ActionReversibility(str, Enum):
    REVERSIBLE = "reversible"
    IRREVERSIBLE = "irreversible"


class EvidenceLink(BaseModel):
    """One entity in a proposed tool call, traced to its origin."""
    value: str
    canonical: str
    origin_turn: Optional[int] = None
    grounded_in: Optional[str] = None   # source id / "user" / None
    status: Optional[ClaimStatus] = None


class ActionVerdict(BaseModel):
    decision: DecisionType
    tool: str
    reversibility: ActionReversibility
    evidence_chain: list[EvidenceLink]
    unresolved_taints: list[ClaimRecord]
    reason: str


class Decision(BaseModel):
    """The full record produced for one checked response (or action)."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    ts: float = Field(default_factory=time.time)
    episode_id: str
    turn: int
    use_case: str
    decision: DecisionType
    risk: list[CategoryRisk] = []
    grounding_verdict: Optional[GroundingVerdict] = None
    correlated_labels: list[list[str]] = []     # clusters debited once ("two labels, one debit")
    coverage: float = 1.0                       # risk-weighted recall retained (see scheduler)
    tier_trace: list[TierTrace] = []
    annotations: list[str] = []
    repaired: bool = False
    repair_note: Optional[str] = None
    degraded: bool = False                      # ran under shed detectors / failure mode
    failure_mode_applied: Optional[str] = None  # fail_open | fail_closed if a fault occurred
    policy_name: str = ""
    policy_version: int = 0
    pack_hash: str = ""
    mode: str = "inline"                        # gate | inline | audit
    # episode economics at the moment of this decision
    debit_inr: float = 0.0
    expected_loss_inr: float = 0.0
    budget_inr: float = 0.0
    budget_exhausted: bool = False
    # telemetry
    latency_ms: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    model_calls: int = 1
    assurance_cost_inr: float = 0.0
    model_cost_inr: float = 0.0
    model_fingerprint: str = ""                 # provider/model + logprobs availability
    ledger_hash: Optional[str] = None


class Override(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    ts: float = Field(default_factory=time.time)
    decision_id: str
    reviewer: str
    verdict: str                    # confirm | overturn
    note: str = ""
    severity: str = "normal"        # normal | high  (high requires a second approver)
    second_approver: Optional[str] = None
    state: str = "applied"          # applied | pending_second_approval

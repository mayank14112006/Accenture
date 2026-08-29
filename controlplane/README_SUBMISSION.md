CONTROLPLANE — EPISODE-LEVEL ASSURANCE FOR ENTERPRISE AI
Accenture Innovation Challenge 2026, Round 2 prototype (Track 1), Team Pluoton

THE GAP. Response-level guardrails are table stakes in 2026: commercial platforms
already score single responses inline. What nobody governs is the EPISODE - the
multi-turn conversation or agent task where one questionable output silently
shapes several downstream decisions, until an agent executes an irreversible
action on a premise it fabricated four turns earlier. The Round 2 brief names this
compounding risk explicitly. ControlPlane governs it.

WHAT THE PROTOTYPE IS. An OpenAI-compatible gateway (change one base_url line to
integrate) that runs three governed use cases concurrently - a customer support
assistant (150ms budget, fail-open), an internal knowledge copilot (1.5s), and a
regulated decision-support agent (10s, fail-closed, gate mode). Tiered detection:
Tier 0 deterministic checks (<1ms, 100% of traffic, never sheds), Tier 1
lexical/heuristic checks with optional ONNX model adapters, Tier 2 LLM-as-judge on
elevated episodes only. An ingress gate blocks direct AND indirect prompt
injection (hostile text inside loosely-governed source documents) before any model
call. Streaming uses sentence-buffered release: PII is masked before it reaches
the wire.

THE THREE MECHANISMS NO RESPONSE-LEVEL TOOL SHIPS.
1) Episode risk budget in rupees: each passed-but-uncertain output accrues hazard
(-ln(1-p) per category); expected loss = sum over categories of (1-e^-hazard) x
severity. Bounded by worst case, deduped for restated claims, and degraded
detector coverage INCREASES the debit. When cumulative expected loss crosses the
pack budget the episode escalates - even though no single response crossed any
threshold.
2) Claim provenance via canonical values: numbers ("Rs 1,20,000" = "one point two
lakh" = 120000), dates, names and IDs are canonicalized; values first appearing
ungrounded in model output are tainted; values supported only by low-trust sources
(email, shared drives - the brief's "loosely governed" data) are flagged with
provenance; derivable values (sums, GST) are whitelisted with their formula.
3) Action gating on reversibility: an irreversible tool call requires a
taint-clear EPISODE, not just clean arguments - a pristine payment call resting on
a fabricated balance claim is held before execution.

GOVERNANCE. Policy is data: versioned, hashed, optionally signed YAML packs per
use case with jurisdiction overlays (IN/EU/US) - a geography switch is one API
call, hot-reloaded, no restart, no code change, with anti-rollback. Every decision
records policy version + pack hash into a hash-chained evidence ledger (keyed HMAC
digests, never raw text; external checkpoint anchoring). Overrides carry reviewer
identity, a two-person rule for high severity, and feed a quarantined,
PII-redacted feedback store used to retune thresholds.

MEASURED, NOT ASSERTED. Every accuracy number is reproduced exactly by scripts in
the repo (python -m evals.generate && python -m evals.run); runtime figures
(latency, throughput, cost %) are hardware-dependent and quoted from the
committed load-test output (machine recorded in the file). Measured on the
2,381-record test split
of a 3,488-record seeded dataset with failures injected by construction:
grounding recall 96.4% (402/417, 95% CI [94.2,97.8]), PII/toxicity/injection/cost
100%, zero false flags on 1,964-2,355 benign records per category, 41/41 tainted
irreversible actions held with 0/47 false holds, 43/43 correct abstentions
(INSUFFICIENT_EVIDENCE when no sources exist), ECE 0.065 - all on the seeded
benchmark; the blind hold-out below scores lower and is quoted alongside. Runtime: p50 12.6ms /
p95 20.3ms assurance overhead per request (lite profile: deterministic +
lexical detectors), 108 req/s on one instance, 0.04% of
model spend (load test), >96% of traffic checked without any LLM call. Detector confidences are isotonic-calibrated on a hold-out split and
prior-shifted to a stated deployment base rate. Caveat stated up front: synthetic
traffic; real-traffic rates are what the shadow phase measures. All rupee
severities are labelled assumptions, agreed with the client risk office in
deployment.

A separate BLIND hold-out (evals/blind/, 52 hand-written cases using formats the
seeded generator never emits - spelled-out digits, base64 injections, mixed
word/digit lakh-crore figures; authorship stated in evals/blind/README.md) scores
lower and is reported as measured, never tuned against: grounding 58.3% (7/12,
with 6 false flags on 40 benign), privacy 50%, toxicity 66.7%, obfuscated
injection 33.3%, cost 100%, abstention 3/3, action gate 1/1 held with 0 false
holds. The gap between seeded and blind is stated deliberately: it is what the
full detector profile and the Tier-2 judge exist to close.

Headline metrics are measured on the sim provider with the lite detector profile
(deterministic + lexical detectors); real-model evidence is produced by
scripts/real_model_smoke.py, which runs a 50-record slice through any live
OpenAI-compatible endpoint and writes decisions + latency to
evals/out/real_model_smoke.json.

HONEST SCOPE. We do not verify truth (we detect unsupported assertion and abstain
explicitly); we do not inspect model internals (API-only, per the brief); we do
not train custom detectors (they are pluggable adapters - bring your own vendor;
the governance layer above them is the product). Bias detection is an
annotate-only heuristic - a structural ceiling enforced after calibration, so it
can flag for human review but never BLOCK - stated, because no honest
off-the-shelf benchmark exists for subtle stereotypes.

RUN IT. docker compose up --build (fully offline, no keys), then open
http://localhost:8080 for the operator dashboard. python -m demo.run_demo replays
the 10-act demo: mid-stream PII repair, abstention, the words-vs-digits taint
catch, the audit-mode side-by-side, the jurisdiction flip reversing a gate
outcome, budget exhaustion at turn 7, the two-person override, fail-open vs
fail-closed, indirect injection, and ledger verification. Full architecture,
limitations and API reference are in README.md in the repository.

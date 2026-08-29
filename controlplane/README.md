# ControlPlane — episode-level assurance for enterprise AI

**Accenture Innovation Challenge 2026 · Round 2 prototype · Problem Track 1 (ControlPlane.ai) · Team Pluoton**

Existing guardrails ask: *is this response safe?*
ControlPlane asks: **is this task still safe, given everything that has already happened in it?**

Response-level checking is table stakes in 2026 — commercial platforms score single
responses inline. What none of them govern is the **episode**: the multi-turn
conversation or agent task where one questionable output silently shapes several
downstream decisions, until an agent executes an irreversible action on a premise
it fabricated four turns ago. That compounding failure mode is named explicitly in
the Round 2 brief, and it is what this prototype governs.

---

## Quickstart (fully offline — no API keys, no model downloads)

```bash
git clone https://github.com/mayank14112006/Accenture.git && cd Accenture/controlplane
docker compose up --build
# gateway + dashboard on http://localhost:8080  (wait for /ready)
```

Or natively (Python 3.11+, Node 18+ for the dashboard):

```bash
pip install -r requirements.txt
python -m pytest tests/            # 53 tests
python -m demo.run_demo            # the 10-act scripted demo (offline, deterministic)
cd dashboard && npm install && npm run build && cd ..
python -m uvicorn controlplane.main:app --port 8080
```

The console starts empty — the decision feed and episode views are live
**in-memory** state and reset on restart; the evidence ledger and the
quarantined feedback store are SQLite on the Docker volume (`CP_DATA_DIR`)
and survive restarts.
Populate every panel (decision feed, gated episode with its evidence chain,
budget-exhaustion episode, override queue) with one command against the
running server:

```bash
python -m scripts.seed_traffic     # defaults to http://127.0.0.1:8080; --url to override
```

Reproduce every number quoted in the business proposal:

```bash
python -m evals.generate           # 3,488-record seeded dataset (byte-identical every run)
python -m evals.run                # fits calibration, measures, writes evals/out/*.json
python -m scripts.load_test        # latency probe + saturation throughput
```

The dataset and all accuracy metrics (recall, CIs, false flags, gate, abstention,
ECE) regenerate **identically** on any machine — `evals/out/results.json` holds
only those and is byte-stable. Latency, throughput and cost-percentage figures
are hardware-dependent: they land in `evals/out/runtime_env.json` /
`load_test.json` (machine recorded in the file), and the quoted runtime numbers
below come from the committed load test.

> Demo runs rewrite packs on purpose (jurisdiction switches bump the pack
> version — policy is data), but they do it on a throwaway temp copy: the
> committed `policies/` are never touched.

## The 10-act demo

`python -m demo.run_demo` walks through, deterministically and offline:

| Act | What it shows |
|---|---|
| 1 | Customer-support lane (150 ms): PII masked **mid-stream** via sentence-buffered release |
| 2 | Copilot: grounded PASS · honest **ABSTENTION** (`INSUFFICIENT_EVIDENCE`) · same claim trusted from the governed KB but flagged when its only support is a forwarded email |
| 3 | **The flagship**: turn 2 fabricates a figure *in words* ("eighty-five thousand"), turn 3 tool-calls it *in digits* → `HOLD_ACTION` before execution; then the clean-arguments/tainted-premise variant; then a human resolves the claim and the action passes |
| 4 | The same episode in **audit (shadow) mode** — what "ControlPlane off" looks like: the wrongful payout would have executed |
| 5 | **Geography is policy data**: IN → US switch (one API call, no restart) reverses the gate outcome on identical content |
| 6 | **Compounding risk**: turns 1–6 each pass with an ANNOTATE flag — none crosses a block threshold — while the episode's ₹ expected-loss budget fills; at turn 7 it exhausts and escalates |
| 7 | Human override with a two-person rule (self-approval refused) and per-reviewer overturn rates |
| 8 | The checker itself crashes: customer chat **fails open** (annotated), the regulated lane **fails closed** (nothing unchecked delivered) |
| 9 | Ingress gate: direct injection blocked, and **indirect injection** inside a loosely-governed source document blocked before the model sees it |
| 10 | Hash-chained ledger verification, telemetry, LLM-vs-non-LLM split, cost meter |

## Architecture

```
client app ──► [1] Gateway (OpenAI-compatible proxy; SSE sentence-buffered release)
                    │
                    ├─► [1a] INGRESS gate (before any model call):
                    │        injection signatures on user input AND retrieved
                    │        sources (indirect injection), input PII
                    │
                    ├─► [2] EGRESS detector ensemble — parallel, per-use-case
                    │        latency budget, per-detector timeout
                    │        Tier 0  <1 ms   deterministic (regex/checksum), 100%, never sheds
                    │        Tier 1  1-60 ms lexical/heuristic (lite) or ONNX models (full)
                    │        Tier 2  ~400 ms LLM judge — elevated episodes only
                    │        → coverage score: risk-weighted recall retained
                    │
                    ├─► [3] Risk fusion: per-detector isotonic calibration →
                    │        noisy-OR per category → correlated clusters debit once
                    │
                    ├─► [4] EPISODE LEDGER: hazard budget (₹ expected loss),
                    │        canonical claim taint, action gate, identity windows
                    │
                    ├─► [5] Policy engine: signed/versioned YAML packs, hot reload,
                    │        anti-rollback, jurisdiction overlays
                    │
                    ├─► [6] Decision: PASS · ANNOTATE · REPAIR · ESCALATE · BLOCK · HOLD_ACTION
                    │
                    └─► [7] Hash-chained evidence ledger (HMAC digests, external
                             anchors)  +  [8] quarantined feedback store → retune
```

Integration is one line: point any OpenAI SDK's `base_url` at the gateway. Context
travels as headers (`X-CP-Use-Case`, `X-CP-Episode-Id`, `X-CP-Identity`) or body
extensions (`cp_use_case`, `cp_episode_id`, `cp_identity`, `cp_sources`, `cp_sim`).
Agent frameworks that manage their own loop call `POST /v1/actions/propose` before
executing any tool.

### The three mechanisms no response-level guardrail ships

**1. Episode risk budget — cumulative hazard, denominated in ₹ expected loss.**
Each passed-but-uncertain output accrues hazard `h_c += -ln(1 - p_c)` per risk
category; episode expected loss is `Σ_c (1 - e^(-h_c)) · severity_c`. This is
bounded by the worst case (naively summing per-turn expected losses can exceed the
maximum possible loss — a 12-turn episode at P=0.15 against ₹50k would "accrue"
₹90k; hazard math cannot). Verbatim restatements are deduped by content hash
(the taint layer additionally dedupes per canonical claim); degraded coverage
*increases* the debit (an uncertainty surcharge — risk can't be laundered through
an overloaded checker). When the episode's expected loss crosses the pack budget,
it escalates — even though no single response ever crossed a block threshold.
Severities are **stated assumptions** in the policy pack; in deployment they are
agreed with the client's risk office during the assessment phase, and the budget
dial is recalibrated from benign-traffic percentiles (`evals/run.py` does this).

**2. Claim provenance and taint — canonical values, not strings.**
Numbers ("₹1,20,000" = "120000" = "one point two lakh"), dates, identifiers, and
names are parsed to canonical forms. A value first appearing in model output with
no support in trusted sources or user input is **tainted**; supported only by a
low-trust source (shared drive, email, agent memory — the brief's "loosely
governed" data) it is **low-trust**; arithmetically derivable from grounded
numbers (sums, GST, discounts) it is **derived**, logged with its formula, and not
tainted. Deterministic, milliseconds, no model call.

**3. Action gate on reversibility — episode state, not just arguments.**
The evidence chain of a tool call = canonical entities in its arguments **union**
all unresolved tainted claims in the episode. An irreversible action (payment,
send, delete, submit) requires a **taint-clear episode** — pristine arguments
resting on a fabricated premise are still held. We cannot see the model's
reasoning (API-only access, per the brief), so the episode's evidence state must
be clean before anything irreversible runs: conservative by construction.

### Honest degradation, stated guarantees

- **Coverage score** = risk-weighted recall retained by the detectors that
  actually ran within the latency budget (weights measured by the eval suite —
  `evals/out/coverage_weights.json`), not "fraction of detectors".
- **Streaming**: Tier-0 gates each sentence against the cumulative prefix before
  release; PII is masked before it reaches the wire. Compositional violations
  detected at completion cut the stream and the partial disclosure is **logged as
  an incident** — released words cannot be unsaid, and we say so.
- **Abstention is a first-class verdict**: no sources → `INSUFFICIENT_EVIDENCE`,
  never an invented confidence score. We do not claim to verify truth — we detect
  **unsupported assertion** against registered sources.
- **Checker failure mode is policy**: customer chat fails open (annotated,
  logged); the regulated lane fails closed. Tier 0 never sheds under load.
- **Calibration**: detector scores → P(real failure) fitted on a held-out split
  (isotonic, per detector), then **prior-shifted** to each pack's stated
  deployment base rate. Decision thresholds use calibrated confidence; the ₹
  ledger uses the deployment-shifted probability. Reliability diagram and ECE
  are on the dashboard.

## Measured results (lite profile — reproduce with `python -m evals.run`)

Test split (2,381 records) of a 3,488-record seeded dataset (~28% injected failures, labels by
construction; archetypes follow HaluEval/RAGTruth, JailbreakBench/garak, and
Presidio-style patterns — see NOTICE):

| Category | Recall (caught/injected) | 95% CI | False flags on benign |
|---|---|---|---|
| Grounding (unsupported assertion) | **96.4%** (402/417) | [94.2, 97.8] | 0 / 1,964 |
| Privacy (PII) | **100%** (132/132) | [97.2, 100] | 0 / 2,249 |
| Toxicity / harmful language | **100%** (96/96) | [96.2, 100] | 0 / 2,285 |
| Prompt injection (incl. indirect) | **100%** (68/68) | [94.7, 100] | 0 / 2,313 |
| Cost anomalies | **100%** (26/26) | [87.1, 100] | 0 / 2,355 |

*Seeded benchmark; the blind hold-out (n=52, authored independently of the
detector code — see below) reads substantially lower: 55% overall recall.*

| Episode-layer metric | Result |
|---|---|
| Tainted irreversible actions **held before execution** | **41/41** (95% CI [91.4, 100]) |
| False holds on clean agent episodes | **0/47** |
| Abstention when no evidence exists | 43/43 |
| Overlap cases carrying both labels, debited once | 132/132 |
| Expected calibration error (ECE) | 0.065 |

| Runtime (this machine, lite profile) | Result |
|---|---|
| Assurance overhead per request (~250-token responses) | p50 **12.6 ms** · p95 **20.3 ms** (lite profile: deterministic + lexical detectors) |
| Single-instance saturation throughput | **108 req/s** (2,000 requests, concurrency 32, 0 errors) |
| Assurance compute vs model spend (metered CPU + judge calls) | **0.04%** (load test; 0.2% on the failure-rich short-output eval mix) |
| Traffic checked without any LLM call | **>96%** |

The 15 missed grounding cases are entity-less recombinations ("USB storage is
always allowed…") — the stated limitation of the deterministic lexical path;
catching them is what the optional NLI adapter (full profile) and the Tier-2
judge exist for.

### Blind hold-out (separate from the seeded benchmark)

`evals/blind/holdout_v1.jsonl` — 52 hand-written cases authored without reference
to the detector source or the generator's phrasings (authorship stated in
`evals/blind/README.md`), scored separately by `evals.run` and never tuned
against. It deliberately uses formats the seeded generator never emits:
spelled-out phone digits, base64 injection payloads, mixed word/digit
lakh-crore figures, entity-less paraphrased claims.

| Category | Blind recall | vs seeded |
|---|---|---|
| Grounding | **58.3%** (7/12), 6 false flags / 40 benign | 96.4%, 0 FP |
| Privacy | **50%** (3/6) | 100% |
| Toxicity | **66.7%** (2/3) | 100% |
| Injection (obfuscated) | **33.3%** (2/6) | 100% |
| Cost | **100%** (2/2) | 100% |
| Abstention | 3/3 | 43/43 |
| Action gate | 1/1 tainted held · 0/1 false holds | 41/41 · 0/47 |

The gap is the honest headline: the lite profile's deterministic + lexical
detectors are strong on the failure formats they were designed for and
substantially weaker on adversarially unusual formats — which is exactly what
the full profile's model adapters and the Tier-2 judge are for, and why the
seeded numbers are always labelled "seeded benchmark" in this repo.

**Caveats on these numbers, stated up front:** they are measured on synthetic
traffic with injected failures by construction — real-traffic rates are
established during the shadow phase, which is what the shadow phase is *for*.
All ₹ figures (severities, avoided loss, costs) are stated, editable assumptions.

## Policy is data

Three packs ship in `policies/`: `customer_support` (150 ms, fail-open, inline),
`internal_copilot` (1.5 s, fail-open), `decision_support` (10 s, **fail-closed,
gate mode**, tool registry with reversibility tags). Jurisdiction overlays
(IN/EU/US) apply via one API call — thresholds, severities and taint rules change,
version bumps, hot reload, no restart, no code change. Packs are Pydantic-validated,
sha256-hashed (every decision records `policy_version` + `pack_hash`), and ship
**HMAC-signed** (`<pack>.yaml.sig`, produced with the demo key in `.env.example` —
rotate in production, where the signing key lives outside the client tenancy).
Verification is enforced whenever `CP_POLICY_SIGNING_KEY` is set: an unsigned or
tampered pack is refused at load and last-known-good keeps serving. Governed
writes through the admin API (jurisdiction switch, operating-point apply) re-sign
on write; hand-edits to a pack while a key is set require re-signing with
`python -m scripts.sign_policies`. Anti-rollback refuses an older validly-signed
pack.

## API sketch

```
POST /v1/chat/completions        OpenAI-compatible; stream or not; returns a
                                 `controlplane` object: decision, risk vector,
                                 coverage, episode economics, ledger hash
POST /v1/actions/propose         gate a tool call before execution
POST /v1/episodes/{id}/resolve_claim   human clears a tainted claim (ledgered)
GET  /admin/metrics /decisions /episodes/{id} /policies /ledger /ledger/verify
POST /admin/policies/{name}/jurisdiction   the geography switch
POST /admin/operating-point      target benign flag rate → thresholds (from the
                                 measured sweep); apply=true writes the pack
POST /admin/overrides            two-person rule for high severity
GET  /ready                      models warmed, first-request-fast
```

## What this prototype deliberately does NOT do (and why)

- **No truth verification.** There is often no real-time ground truth (the brief
  says so). We detect unsupported assertion and abstain explicitly.
- **No model internals.** Enterprises consume models via API; everything works at
  the I/O layer. Log-prob entropy is used opportunistically when the provider
  returns it, recorded in the model fingerprint — never faked with a proxy.
- **No custom-trained detectors.** Detectors are pluggable adapters (bring your
  own vendor — Tier-1 upgrades to ONNX NLI/toxicity models via
  `requirements-models.txt`). The governance layer above them is the product.
- **Bias scoping.** Demographic-stereotype detection in the lite profile is a
  heuristic whose signals are marked `annotate_only` — a structural ceiling
  enforced AFTER calibration and fusion (`CategoryRisk.prob_enforce`), so a
  bias-only finding can ANNOTATE for human review but can never BLOCK, no
  matter how the calibration table rates the detector
  (`tests/test_bias_scope.py` locks this). There is no honest off-the-shelf
  benchmark for subtle-stereotype classification, so we do not claim one.
- **Simulated traffic and a scripted agent.** The SimLLM provider replays
  request-keyed fixtures (`cp_sim`), so demos and evals are deterministic and
  offline; because fixtures key on the request, not the policy, replaying the
  same episode under a different jurisdiction shows different *decisions* on
  identical content. Set `CP_PROVIDER=openai` + `OPENAI_*` env vars for any live
  OpenAI-compatible upstream — or `CP_PROVIDER=gemini` + `GEMINI_API_KEY` for
  Google Gemini via its OpenAI-compatible endpoint (defaults to
  `gemini-2.5-flash`; the logprobs param is auto-dropped if the endpoint
  rejects it). For live-model evidence, `python -m scripts.real_model_smoke`
  pushes a 50-record slice through any configured endpoint and writes decisions
  + latency to `evals/out/real_model_smoke.json` — run it before recording the
  demo video.
- **Prototype shortcuts, named:** anti-rollback high-water mark is in-memory
  (production anchors it in the ledger); episode store is in-process (production:
  shardable by episode_id); ledger anchoring appends to a local checkpoint file
  (production: RFC 3161 timestamping / object-lock storage); OpenTelemetry export
  is a roadmap item — telemetry is in-app counters on `/admin/metrics`.

## Repository layout

```
controlplane/        the gateway (detectors/, episode, taint, policy, fusion,
                     scheduler, decision, ledger, feedback, telemetry)
policies/            YAML packs + jurisdiction overlays — the no-code-change demo
evals/               generate.py (seeded dataset) · run.py (reproduces all numbers)
                     · out/ (results.json, calibration, sweep, coverage weights)
demo/                run_demo.py — the 10-act offline demo
dashboard/           React + Vite + Recharts operator console (served at /)
scripts/             load_test.py · sign_policies helper
tests/               53 pytest tests on the mechanisms that matter
```

Apache-2.0. Dataset/model attributions in NOTICE.

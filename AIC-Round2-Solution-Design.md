# ControlPlane — Round 2 Solution Design
### Accenture Innovation Challenge 2026 · Problem Track 1 · ControlPlane.ai

---

# PART 0 — What Round 2 actually grades

## The five deliverables

| # | Deliverable | Format | What it really tests |
|---|---|---|---|
| 1 | Public GitHub link | URL, 500 chars | Does the code exist, run, and look maintained |
| 2 | Prototype video | mp4 / mov | Does the core mechanism visibly work |
| 3 | README document | **pasted text**, not a file | Can you explain architecture to an engineer |
| 4 | Detailed Business Proposal | PDF | Can you defend a P&L |
| 5 | Detailed Business Proposal | PPTX | Can you pitch it in 10 minutes |

Fields 4 and 5 carry the same label, which almost certainly means one artifact exported twice. Build **one deck**, export to PDF. Two different documents invites inconsistency, and a juror who spots a contradiction between your PDF and your PPT will find nothing else in your submission credible.

The README is a **textarea**, not an upload. It must read well as plain text with no images. Keep the identical text as `README.md` in the repo.

## The three judging criteria

The first AIC finale scored on <cite index="5-1">innovativeness, technical viability and impact</cite>, and the 2026 grand finale asks for a <cite index="21-1">production-ready, scalable version presented in a 10-minute pitch followed by 5-minute Q&A</cite>. Design every artifact against those three words. Innovation without viability reads as naive; viability without impact reads as a science project.

## The checklist Accenture didn't give you

Tracks 2 and 3 have an explicit **Minimum Prototype Expectations** list. Track 1 does not. That omission is your single biggest advantage, because most Track 1 teams will under-scope without realising it. Reverse-engineer the equivalent bar from the other tracks and hold yourself to it:

1. Three concurrent use cases with genuinely different latency and risk profiles
2. At least one case where risk categories overlap (a fabricated detail about a real person = hallucination **and** privacy)
3. At least one case with no ground truth available, where the system **abstains** instead of inventing a verdict
4. An explicit false-positive / false-negative operating point, chosen and justified
5. One multi-turn episode where risk compounds across turns
6. One agent tool call gated *before* execution
7. A policy change by geography with **no code change**
8. One human override, and exactly what the system logs
9. Runtime telemetry: latency, model calls, token usage, estimated cost
10. A clear breakdown of LLM vs non-LLM processing

Item 10 is lifted directly from Track 3's list. Steal it — it's the fastest way to prove engineering maturity, and it counters the laziest criticism a juror can make ("so it's just a wrapper around an LLM").

---

# PART 1 — What past winners actually did

| Winner | What they did differently |
|---|---|
| **Chandigarh University, AIC 2022 (E-track)** | The winner said he <cite index="8-1">focused on creating a robust prototype to create an initial impact on the judges, which later helped in pitching the detailed version, because the jury was already impressed having seen a glimpse of it in previous rounds</cite> |
| **IIM Udaipur, AIC 2022 (B-track)** | <cite index="17-1">In-depth primary and secondary research so the solution wasn't superficial, all stakeholders considered, plus a planned pilot project and go-to-market strategy</cite> |
| **UVA, US edition 2020** | Won with an AI image classifier **plus** <cite index="15-1">a portal to support volunteer collaboration and the creation and tracking of location-specific removal plans</cite> — the operating system around the model, not just the model |
| **Black Garage, 2024** | Quantified the market in ₹ crore, gave a before/after operational metric and a cost-reduction percentage, and paired AI with a physical operating model |
| **Rice, US edition 2023** | Folded a "wow" technology layer (AR/VR) into an otherwise operational concept |

**The pattern, in one line:** winners pair a working prototype shown early and consistently with a stakeholder-complete operating model, a pilot, a GTM plan, and quantified economics. Almost none of them won on model accuracy.

**Two direct implications for you:**

- **Continuity beats novelty.** Keep the name ControlPlane and the visual language from your Round 1 deck. The jury that shortlisted you has a memory of it. Sharpen the same idea; do not arrive with a different one.
- **Design the operating system, not the detector.** Your competitors will build a classifier and a dashboard. You build the policy layer, the escalation workflow, the audit evidence, the operating-point console, and the managed-service wrapper.

---

# PART 2 — The strategic problem with your Round 1 pitch

Round 1's differentiators were: a tiered latency cascade, inline interception, and a unified three-axis decision. **Two of those three are no longer differentiators in 2026.** You need to know this before you build, because a juror who follows this market will know it.

- Fiddler ships <cite index="41-1">"Centor Models" — small models built for the job that run inside your own environment, returning safety, faithfulness and PII checks quickly, so you can score every production response rather than sampling only 2%</cite>. That is your Tier 1, already commercialised.
- Galileo advertises <cite index="24-1">real-time guardrails blocking unsafe outputs in under 200ms with configurable rules, rulesets and stages</cite>.
- OpenTelemetry-native tracing, policy mapping to the EU AI Act, NIST AI RMF and ISO 42001, and <cite index="26-1">federated data-plane / control-plane architecture so sensitive inference data stays inside your VPC</cite> are all described as baseline expectations.

So the cascade is table stakes now. **Keep it — but stop selling it as the innovation.**

## The gap that is genuinely unclaimed

One sentence from the 2026 market analysis defines your opening:

> <cite index="41-1">Every gateway hits the same ceiling. It sees requests, not reasoning. It knows your agent made nine model calls. It doesn't know they were nine steps from one plan.</cite>

And the Round 2 brief names the same gap in its own words: *"Multi-turn conversations and AI agents that take actions introduce compounding risk, where one questionable output can shape several downstream decisions."*

**Those are the same problem.** Nobody has solved it, Accenture has explicitly asked about it, and it is buildable by a student team.

Supporting evidence that this is live and urgent: 2026 research found <cite index="40-1">10 of 11 surveyed open-source coding and computer-use agents could bypass raw-string shell guards (GuardFall), defensive-review modes could be steered by hostile repository content (Friendly Fire), and persistent memory could be poisoned from a single external email (MemGhost)</cite>. Meanwhile <cite index="24-1">Deloitte's 2026 AI report found only 20% of organisations have mature governance models</cite>.

---

# PART 3 — Business strategist view

## The repositioning

| | Round 1 | Round 2 |
|---|---|---|
| Unit of governance | The response | **The episode** |
| Claim | "We verify every response inline" | "We govern the whole task, because risk compounds" |
| Wedge | Latency cascade | **Episode risk budgets + claim provenance + action gating** |

**One-line positioning:** *Existing guardrails ask "is this response safe?" ControlPlane asks "is this task still safe, given everything that has already happened in it?"*

## Three mechanisms that make it real

**1. Episode risk budget — denominated in expected loss (₹).** Every conversation or agent task opens with a budget in *expected-loss currency*: each passed-but-uncertain output debits `P(failure) × severity(₹)` from it. When the budget is exhausted the episode escalates, even though no single response ever crossed a threshold on its own. Two properties make this defensible under questioning: the debit math is expected loss, not an arbitrary sum of incomparable scores; and the budget itself is set **empirically in shadow mode** (e.g., the 95th percentile of cumulative expected loss across benign episodes), not picked from the air. A side effect that matters: the tech metric and the business ROI meter are now the *same number* in the same units. This is the direct answer to compounding risk, and no shipping product does it.

**2. Claim provenance and taint propagation — with a deterministic fast path.** Full semantic claim extraction needs an LLM call, which would be the weakest and most expensive link if run on every turn. So it isn't. The fast path tracks only **entities, numbers, dates and identifiers** via NER and regex — deterministic, milliseconds, no model call — and taints those tokens when they first appear in an ungrounded output. Full claim extraction runs only on episodes already flagged as elevated. If a tainted number from turn 3 shows up inside a tool-call argument at turn 7, the gate fires. Say this trade-off out loud in the pitch; pretending claim extraction is free is exactly the kind of thing a juror catches.

**3. Action gating on reversibility.** Before an agent executes a tool call, ControlPlane inspects the *evidence chain* behind it. Irreversible actions (payment, send, delete, submit) require a clean chain. Reversible ones do not. Note that market reviews call actual containment <cite index="38-1">the rarest capability</cite> among governance platforms — this is where you plant your flag.

## Personas

| Persona | Buys | Kills the deal if |
|---|---|---|
| Head of AI Engineering | Latency budget, one-line integration, model neutrality | It adds visible latency |
| Chief Risk / Compliance Officer | Evidence ledger, policy packs per jurisdiction | Audit trail isn't defensible |
| CFO / FinOps | Cost per verified request, ROI meter | Assurance costs more than the model |
| Contact-centre agent (operator) | Escalations with context, low noise | Alert fatigue |
| End customer | Never sees the failure | — |

## Business model, shaped for Accenture

- **Land** — 6-week Assurance Assessment, fixed fee. Inventory the client's AI use cases, run ControlPlane in shadow mode, deliver a risk baseline.
- **Expand** — deploy inside client tenancy. Platform fee plus price per million verified requests.
- **Run** — managed assurance service: L1/L2/L3 triage of escalations, quarterly policy pack updates, recalibration.

This is deliberately Accenture's own consulting-to-managed-services motion. Say so in the deck. A jury of Accenture MDs is evaluating whether they could sell this on Monday.

**And make the detectors pluggable.** The strongest answer to "why wouldn't the client just buy Fiddler or Galileo?" is: *they can.* Detectors are swappable adapters — bring your own guardrail vendor. What ControlPlane owns is the layer none of the vendors ship: the episode ledger, the policy packs, the operating-point governance and the delivery methodology around them. That is services-firm IP, which is exactly what Accenture monetises. Positioned this way, the vendors become channel, not competition.

## Business case — show the method, never a bare number

Build the case from stated assumptions, on screen:

```
Volume       = 40,000 interactions/week ≈ 2.1M/year   (from the brief's parameters)
Failure rate = f% of responses carry material risk     (measure this in shadow mode)
Cost/failure = remediation + goodwill + regulatory exposure
Avoided loss = Volume × f% × catch_rate × Cost/failure
Assurance $  = detector compute + small-model inference + escalation labour
ROI          = Avoided loss ÷ Assurance $
```

For the Indian jurisdiction, DPDP Act penalty exposure for failure to safeguard personal data gives you a real, citable ceiling rather than an invented figure. Local regulation on an Indian jury's slide is worth more than a US analyst statistic.

**Never present a single ROI number without the assumption stack beside it.** A consulting jury will attack an unsourced number and ignore everything after it.

## Phased roadmap

| Phase | Window | What happens | Why it matters |
|---|---|---|---|
| 0 — Shadow | Weeks 0–6 | Observe only, zero enforcement. Establish FP/FN baseline | This is your change-management answer. Nobody trusts a blocker on day one |
| 1 — Enforce one | Weeks 6–14 | One use case, conservative operating point | Small blast radius |
| 2 — Estate | Months 4–8 | All use cases, policy packs per jurisdiction | Proves the policy layer |
| 3 — Agents | Months 8–18 | Episode budgets, action gating, cross-estate | The high-value expansion |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| False positives cause alert fatigue and bypass | Shadow mode first; operating-point console; every override becomes training data |
| Latency regression | Budget scheduler with per-detector timeout; circuit breaker |
| **Failure mode of the checker itself** | **Fail-open vs fail-closed is configured per use case.** Customer chat fails open with annotation; regulated decision-support fails closed |
| Detector drift | Weekly recalibration against a frozen canary set |
| Model vendor changes behaviour | Model-agnostic I/O layer; model fingerprint recorded per decision |
| The checker is itself an attack surface | Red-team it; cite GuardFall; injection detection on the detector inputs |
| Ledger becomes a privacy liability | Store hashes not raw text; configurable retention |

The fail-open row is the one most teams will miss entirely. It signals you have thought about production, not demos.

---

# PART 4 — Technical architecture

## Layers

```
Client app  ──►  [1] Gateway (OpenAI-compatible proxy, SSE streaming)
                      │
                      ├─►  [1a] INGRESS gate — runs BEFORE the model call:
                      │         prompt injection, jailbreak signatures, PII in the
                      │         user's own input, policy pre-checks
                      │
                      ├─►  [2] EGRESS detector ensemble, in parallel under a latency budget
                      │        S0  <5ms    deterministic, 100% of traffic
                      │        S1  20–80ms small models, conditional
                      │        S2  300ms+  LLM judge / self-consistency, rare
                      │
                      ├─►  [3] Risk fusion  →  multi-label vector + calibrated confidence
                      │
                      ├─►  [4] Episode ledger  →  budget debit, claim taint, action gate
                      │
                      ├─►  [5] Policy engine  →  signed, versioned YAML packs (data, not code)
                      │
                      ├─►  [6] Decision  →  PASS │ ANNOTATE │ REPAIR │ ESCALATE │ BLOCK │ HOLD-ACTION
                      │
                      └─►  [7] Evidence ledger (hash-chained)  +  [8] Feedback loop
```

## Design decisions that will win the Q&A

**Latency-budget scheduler.** Each use case declares a budget (customer chat 150ms, internal copilot 1.5s, decision-support 10s). The scheduler runs the largest detector set that fits, in parallel, and returns a **coverage score**: *"checked at 62% coverage, because the budget was 150ms."* Honest degradation. No competitor reports this, and it directly answers the brief's point that one-size-fits-all checking fails.

**Never claim to verify truth.** There is often no real-time ground truth — the brief says so. So do not claim fact-checking. Claim detection of **unsupported assertion**: a claim not entailed by any retrieved source. That is checkable without ground truth, and it is an honest, defensible framing that will survive a hostile question.

**Abstention as a first-class output.** When evidence is insufficient or contradictory, return `INSUFFICIENT_EVIDENCE` with a reason — not a fabricated confidence score.

**Multi-label, single decision.** Risk is a vector `{groundedness, privacy, bias, safety, injection, cost}`, each with its own calibrated confidence. One fused action. This is the brief's overlapping-categories problem, solved by refusing to force a single label.

**Policy as data.** Signed, versioned YAML packs keyed on `use_case × jurisdiction × data_sensitivity × action_reversibility`. Hot-reloadable. Every decision records `policy_version` and `pack_hash`. Demo the geography switch live with no restart — that is a 20-second moment that lands hard.

**Degrade gracefully without logprobs.** Some model APIs expose token log-probabilities and some do not. Design the entropy detector to fall back to self-consistency sampling or a local scorer when they are unavailable, and say so. This shows you understand the brief's point about API-only access to foundation models.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Gateway | Python 3.11 + FastAPI, SSE streaming | OpenAI-compatible means one-line integration: change `base_url` |
| PII | Microsoft Presidio + spaCy NER | Deterministic, fast, well-known to reviewers |
| Groundedness | `cross-encoder/nli-deberta-v3-small` | Entailment, CPU-viable, ~30ms |
| Toxicity / bias | Distilled classifier (Detoxify class) | Small, local |
| Anomaly | sentence-transformers embeddings vs. per-use-case baseline | Catches drift and off-distribution outputs |
| Judge | Any LLM API behind an interface | Swappable, and proves model neutrality |
| Scheduler | `asyncio.gather` + per-detector `wait_for` | The latency budget, in ~40 lines |
| Policy | YAML + Pydantic validation + watchdog hot-reload | Policy as data |
| Ledger | SQLite with a `prev_hash` column | A hash chain. **Do not say blockchain** — restraint reads as maturity |
| Telemetry | OpenTelemetry | Table stakes in 2026 |
| Dashboard | React + Vite + Tailwind + Recharts | The finale is a pitch; it needs to look real |
| Load | Locust or an asyncio driver | Prove the throughput claim |
| Ship | `docker compose up` | A juror who can't run it will assume it doesn't |

## How to measure FP/FN without real data

This is the methodological trick that makes your numbers defensible:

**Inject known failures into synthetic traffic, so you have labels by construction.** Generate ~2,000 interactions across the three use cases, deliberately seeding hallucinations, PII leaks, biased phrasings, prompt injections, cost bombs and multi-turn compounding chains at known positions. You now have ground truth, so precision, recall and calibration are *measured*, not asserted.

Public datasets to anchor each detector: HaluEval and RAGTruth for hallucination, BBQ and CrowS-Pairs for bias, Presidio/Faker synthetic records for PII, JailbreakBench or garak for injection.

## The three demo use cases

| | Latency budget | Risk tolerance | Demonstrates |
|---|---|---|---|
| Customer support assistant | 150ms | Low on privacy and brand | Streaming interception, coverage score, fail-open |
| Internal knowledge copilot | 1.5s | Medium | Fuller detector set, groundedness against internal docs |
| Regulated decision-support agent | 10s | Lowest, takes actions | **Episode budget, claim taint, action gating, fail-closed** |

The third is where you win. Everything unique lives there.

---

# PART 5 — Coverage audit: every brief requirement mapped

Print this table in the appendix of your proposal. It tells a juror you left nothing uncovered.

| Brief requirement | Where it's handled |
|---|---|
| Different use cases, different risk and latency budgets | Per-use-case policy packs + latency-budget scheduler + coverage score |
| Bias, hallucination, privacy overlap | Multi-label risk vector, single fused decision |
| No reliable real-time ground truth | Unsupported-assertion detection, not fact-checking; explicit abstention |
| Over-flagging vs under-flagging tradeoff | Operating-point console; owner sets acceptable FP rate, system solves thresholds |
| Multi-turn and agent compounding risk | **Episode risk budget + claim taint propagation + action gating** |
| Regulation varies and evolves | Policy-as-data, signed and versioned; hot-reload; jurisdiction matrix |
| API-only foundation models | I/O-layer design; graceful degradation when logprobs are unavailable |
| Detection techniques | S0 rules, S1 small models, S2 judge, retrieval verification, Presidio |
| Decision logic | PASS / ANNOTATE / REPAIR / ESCALATE / BLOCK / HOLD-ACTION on risk × reversibility |
| Architecture and parallel checks | Inline gateway; `asyncio.gather` with per-detector timeouts |
| Governance and audit trail | Policy engine + hash-chained evidence ledger |
| Feedback loops | Overrides become labelled data; weekly recalibration; drift monitor |
| Metrics for a sceptical stakeholder | FP/FN with confidence intervals, calibration curve, ECE, coverage, p50/p95/p99, cost per 1k, incidents prevented |

---

# PART 6 — Build order

Build in this sequence. Each step produces something demonstrable, so you always have a working prototype even if you run out of time.

1. **Gateway + S0 detectors + SQLite ledger** — end-to-end skeleton. Demoable on day one.
2. **Policy engine with three use-case packs** — proves configurability early.
3. **S1 detectors + the latency budget scheduler** — the coverage score appears here.
4. **Synthetic traffic generator with injected failures** — now you have numbers.
5. **Episode ledger: budget, taint, action gate** — **this is your differentiator. Do not let it slip to last.**
6. **Dashboard + operating-point console.**
7. **S2 judge + REPAIR path.**
8. **Load test, telemetry, docker compose, README.**
9. **Video, then deck, then PDF export.**

If time runs short, cut step 7 before step 5. A polished commodity feature is worth less than a rough unique one.

## Repo hygiene the jury will check

- `README.md` identical to the pasted textarea version
- `docker compose up` works from clean clone
- An architecture diagram committed as an image
- `/evals` with the synthetic dataset and a script that reproduces your FP/FN numbers
- `/policies` with the three YAML packs
- Real commit history across several days, not one dump
- MIT or Apache-2.0 licence
- No secrets committed; `.env.example` present

## Video

Same discipline as Round 1: open on the failure, not on your names. The one shot that must be in it is the **side-by-side** — identical agent task with ControlPlane off and on, where the off version confidently completes an irreversible action on a tainted premise and the on version holds it. That is the whole pitch in fifteen seconds.

---

# PART 7 — Answers to the five questions the jury will ask

**"How is this different from Fiddler, Galileo, or Arthur?"**
They govern responses. We govern episodes. No shipping product tracks cumulative risk across a task or gates an action on the provenance of the claims behind it. Their own market analysis says gateways see requests, not reasoning.

**"What if your checker is wrong?"**
It will be, at a rate we publish. That is why enforcement starts in shadow mode, why the operating point is a business decision rather than an engineering default, and why fail-open versus fail-closed is configured per use case.

**"How do you verify a claim with no ground truth?"**
We don't. We detect unsupported assertion — claims not entailed by retrieved evidence — and abstain explicitly when evidence is insufficient. Claiming to verify truth would be the dishonest answer.

**"What does this cost to run?"**
Roughly 97% of traffic never touches a large model. Assurance cost is reported live as a percentage of the underlying model spend, and the target is under 3%.

**"Why would Accenture build this rather than buy it?"**
Accenture has already delivered thousands of GenAI projects and none of them ship with episode-level assurance. This is a managed service that attaches to every one of them, in the client's own tenancy, on any model, on any cloud.

---

# PART 8 — Adversarial self-review: where this design can be attacked, and the patches

Run this review against any version of the build before submission. Each item below was a real weakness in the first draft of this document; the patches are now integrated above.

| # | Attack | Patch |
|---|---|---|
| 1 | "Your risk budget is an arbitrary sum of incomparable scores." | Budget is denominated in **expected loss (₹)** — debit = P(failure) × severity — and calibrated empirically from shadow-mode benign episodes. Same units as the ROI meter |
| 2 | "Claim extraction needs an LLM call per turn — that's slow, costly, and itself unreliable." | Deterministic fast path: taint entities/numbers/dates via NER + regex on all traffic; full LLM claim extraction only on already-flagged episodes |
| 3 | "Why wouldn't the client just buy Galileo?" | Detectors are pluggable adapters. The episode layer, policy governance and delivery methodology are the IP. Vendors become channel |
| 4 | "Show me p95 under load, not on one request." | Run S1 models in a separate ONNX runtime process, batch where possible, and **report the measured number even if it misses the target**. A measured 80ms beats a claimed 60ms in front of this jury |
| 5 | "The demo depends on a live LLM API." | Ship a replay mode: recorded fixtures for every demo path, plus a small local model fallback. The finale demo must survive the venue Wi-Fi failing |

Three further judgements that keep this on the feasible side of the frontier:

- **Minimum winning subset**, if the timeline collapses: gateway + S0/S1 detectors + policy packs + episode ledger + injected-failure evals + dashboard. The S2 judge and the REPAIR path are the first cuts — they are commodity features in 2026 and their absence costs far less than a missing episode layer.
- **Feedback loop stays thin by design** in the prototype: overrides land in a labelled store, one script re-tunes thresholds from it, the dashboard shows before/after. That is a complete, honest loop. Building online learning would burn a week for zero additional credit.
- **Do not chase custom model training.** Fine-tuning your own hallucination or bias detector looks impressive on a slide and is the single most likely way to lose two weeks and arrive with nothing. Off-the-shelf detectors, novel governance layer — that allocation of effort is the whole strategy.

---

# PART 9 — Loophole audit

Three sweeps: adversarial (can the system itself be defeated), evidential (can the claims be broken in Q&A), procedural (can the submission fail on logistics). Every item below is now either patched in the design or listed as a rule for the build.

## 9.1 Adversarial loopholes — ways to defeat ControlPlane itself

| # | Loophole | Patch |
|---|---|---|
| A1 | **Everything checked on the way out, nothing on the way in.** Prompt injection arrives in the *input*; an output-only checker sees it too late | Dual-gate architecture: an ingress gate runs injection, jailbreak and input-PII checks *before* the model call. Now explicit in the diagram |
| A2 | **Streaming contradicts blocking.** "We verify sentence one while sentence eight generates" — but sentence one already reached the user. For a PII leak, that's game over | Sentence-buffered release: each sentence is held until S0/S1 clears it (5–80ms hold), then released. High-risk use cases buffer; low-risk stream freely. Perceived latency stays near zero because the hold window equals detector time. **Fix the Round-1 wording — a sharp juror will catch the old version** |
| A3 | **Budget-reset evasion.** Start a "new" conversation every few turns and the episode risk budget resets — risk gets laundered through session splitting | Episode identity is not just a session header: identity-scoped rolling budgets (per user / per service account / per agent identity) sit above per-episode budgets. Prototype implements the header + a rolling per-identity window; state the production design honestly |
| A4 | **Induced fail-open.** Flood the system until the circuit breaker trips, then everything passes unchecked | S0 never sheds — deterministic checks are cheap enough to survive any load. Degraded mode drops S1/S2 only, is logged, alerts after a sustained window, and fail-open is *configured off* for regulated use cases regardless of load |
| A5 | **REPAIR as an infinite loop.** Regeneration can produce another bad output, or loop forever burning tokens | One repair attempt maximum, repaired output re-enters the full check path, then escalate. Hard cap on repair token spend per episode |
| A6 | **Override abuse.** A human reviewer rubber-stamps escalations to clear a queue | Overrides are logged with reviewer identity; high-severity overrides require a second approver; override-rate-per-reviewer is a dashboard metric |

## 9.2 Evidential loopholes — ways to break the claims

| # | Loophole | Patch |
|---|---|---|
| E1 | **Circular evaluation.** ">90% catch rate on failures we injected ourselves" invites: "you caught the failures you designed to be caught" | Build the injection set *from public benchmarks* (HaluEval, RAGTruth, JailbreakBench, BBQ), not hand-written cases — and hold out a blind set written by the teammate who did **not** build the detectors. Report both numbers |
| E2 | **Privacy contradiction in your own design.** "The ledger stores hashes, not raw text" vs "overrides become labelled training data" — labelled data *is* raw text | Split stores: the evidence ledger keeps hashes only; a separate quarantined feedback store keeps PII-redacted text with an explicit retention period. Two stores, two policies, said out loud |
| E3 | **Deployment-mode gap.** The brief lists pre-response gate, inline middleware *and post-hoc audit* as architecture options; the design reads inline-only | Same engine, three modes: gate (block-capable), inline (annotate/stream), audit (shadow). Shadow mode already existed in the roadmap — name it as the third mode explicitly |
| E4 | **No competitor slide.** Omitting Fiddler/Galileo/Arthur from the deck reads as ignorance, not confidence | Mandatory competitive slide: name them, credit what they do well, position on the episode layer + detector-pluggability. Juries trust teams who name their competition |

## 9.3 Procedural loopholes — ways the submission itself fails

1. **The R2 video is a file upload (mp4/mov), not a link.** Different from Round 1 — no YouTube needed. Export H.264, keep it well under the portal's size limit, and test the upload days early, not at the deadline.
2. **The README field is a textarea.** It may have a character cap that isn't visible until you paste. Prepare a compact version (~600–800 words, plain text, no images) *and* keep the full version in the repo. Test the paste early.
3. **GitHub link field allows 500 characters** — trivial, but the repo must be public at submission *and stay public through judging*. A repo flipped private mid-review is a silent disqualification.
4. **Clean-clone test.** `git clone && docker compose up` on a machine that has never seen the project, before submitting. A juror's first command is the one most repos fail.
5. **No large binaries in the repo.** The video does not live in git. Keep the repo cloneable in seconds.
6. **Licensing hygiene.** MIT/Apache-2.0 licence, a NOTICE file attributing datasets and models (Presidio, DeBERTa NLI, HaluEval etc.). Missing attribution is the cheapest possible thing to get flagged for.
7. **PDF ↔ PPT consistency.** One deck, exported twice, byte-for-byte same content. Verify numbers match the README and the dashboard — a mismatch between any two artifacts is the easiest catch a juror can make.
8. **Round 3 is a live discussion.** Every team member must be able to explain every layer without notes — including code any AI assistant helped write. If one of you can't whiteboard the episode-budget math or the scheduler, that's a loophole in the *team*, and it's the one juries exploit most. Rehearse the five questions in Part 7 against each other, hostile tone included.
9. **Confirm the Round 2 deadline on the Unstop portal now** and back-plan the build order from it with a 3-day buffer. This document intentionally contains no assumed date.

## 9.4 What is deliberately out of scope — and why that's stated, not hidden

A "no loopholes" posture does not mean claiming to do everything. It means the boundary is explicit so nobody discovers it for you:

- **We do not verify truth** — we detect unsupported assertion and abstain (Part 4). Stated.
- **We do not inspect model internals** — API-only access is a brief constraint; we work at the I/O layer. Stated.
- **We do not train custom detectors** — off-the-shelf detectors under a novel governance layer is the strategy. Stated.
- **The prototype simulates enterprise traffic** — the brief explicitly permits and encourages this. State your assumptions on one slide, exactly as the brief invites.

The last defence against loopholes is the sentence a confident team says on stage: *"Here is what it doesn't do, and here is why that's the right scope."* Rehearse it.

// ControlPlane — Round 2 pitch deck generator (one deck -> PPTX + PDF)
// Every number on these slides is reproduced by controlplane/evals or the demo.
const pptxgen = require("pptxgenjs");

const BG = "0B0F14", PANEL = "11161D", PANEL2 = "0E131A", BORDER = "263140";
const TEXT = "D7DEE8", MUTED = "8A9AAD", WHITE = "FFFFFF";
const SKY = "38BDF8", RED = "EF4444", GREEN = "22C55E", AMBER = "EAB308",
      ORANGE = "F97316", PURPLE = "A855F7";
const F = "Arial";
const W = 13.33, H = 7.5, MX = 0.55;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { bodyFontFace: F, headFontFace: F };

let pageNo = 0;

function baseSlide(kicker, title, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: BG };
  pageNo += 1;
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: MX, y: 0.32, w: W - 2 * MX, h: 0.3, fontFace: F, fontSize: 11,
      color: SKY, charSpacing: 3, bold: true, margin: 0,
    });
  }
  if (title) {
    s.addText(title, {
      x: MX, y: 0.58, w: W - 2 * MX, h: 0.75, fontFace: F,
      fontSize: opts.titleSize || 27, color: WHITE, bold: true, margin: 0,
    });
  }
  s.addText(`ControlPlane · Round 2 · ${String(pageNo).padStart(2, "0")}`, {
    x: W - 3.2, y: H - 0.38, w: 3.2 - MX, h: 0.3, fontFace: F, fontSize: 8.5,
    color: MUTED, align: "right", margin: 0,
  });
  return s;
}

function panel(s, x, y, w, h, opts = {}) {
  s.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.07,
    fill: { color: opts.fill || PANEL },
    line: { color: opts.border || BORDER, width: opts.borderW || 0.75 },
  });
}

function statTile(s, x, y, w, h, big, label, color, sub) {
  panel(s, x, y, w, h);
  s.addText(big, { x: x + 0.14, y: y + 0.10, w: w - 0.28, h: h * 0.48,
    fontFace: F, fontSize: 24, bold: true, color: color || WHITE, margin: 0 });
  const rows = [{ text: label, options: { fontSize: 9.5, color: TEXT, breakLine: !!sub } }];
  if (sub) rows.push({ text: sub, options: { fontSize: 8, color: MUTED } });
  s.addText(rows, { x: x + 0.14, y: y + h * 0.52, w: w - 0.28, h: h * 0.44,
    fontFace: F, margin: 0, valign: "top" });
}

function sectionLabel(s, x, y, text, color, w) {
  s.addText(text.toUpperCase(), { x, y, w: Math.min(w || 6, W - MX - x), h: 0.26,
    fontFace: F, fontSize: 10, bold: true, color: color || MUTED,
    charSpacing: 2.5, margin: 0 });
}

function bullets(s, x, y, w, h, items, opts = {}) {
  const arr = items.map((it, i) => ({
    text: typeof it === "string" ? it : it.text,
    options: {
      bullet: { code: "2022", indent: 10 },
      color: (typeof it === "object" && it.color) || TEXT,
      fontSize: opts.fontSize || 11.5,
      paraSpaceAfter: opts.space === undefined ? 6 : opts.space,
      breakLine: i < items.length - 1,
      bold: typeof it === "object" && !!it.bold,
    },
  }));
  s.addText(arr, { x, y, w, h, fontFace: F, margin: 0, valign: "top" });
}

// ============================================================ 1 · TITLE
{
  const s = pres.addSlide();
  s.background = { color: BG };
  s.addText("ACCENTURE INNOVATION CHALLENGE 2026 · ROUND 2 · PROBLEM TRACK 1", {
    x: MX, y: 0.75, w: W - 2 * MX, h: 0.3, fontFace: F, fontSize: 12,
    color: MUTED, charSpacing: 3, margin: 0,
  });
  s.addText("ControlPlane", {
    x: MX, y: 1.7, w: W - 2 * MX, h: 1.2, fontFace: F, fontSize: 66,
    bold: true, color: WHITE, margin: 0,
  });
  s.addText([
    { text: "Govern the ", options: { color: TEXT } },
    { text: "episode", options: { color: SKY, bold: true } },
    { text: ", not the response.", options: { color: TEXT } },
  ], { x: MX, y: 2.95, w: W - 2 * MX, h: 0.6, fontFace: F, fontSize: 26, margin: 0 });
  s.addText(
    "One questionable output shapes several downstream decisions — until an agent " +
    "executes an irreversible action on a premise it fabricated four turns ago. " +
    "Response-level guardrails cannot see it. ControlPlane holds it.",
    { x: MX, y: 3.7, w: 8.6, h: 1.0, fontFace: F, fontSize: 13.5, color: MUTED, margin: 0 });

  const tiles = [
    ["41/41", "tainted irreversible actions held before execution", PURPLE],
    ["0/47", "false holds on clean agent episodes", GREEN],
    ["12.6 ms", "median assurance overhead per request", SKY],
    ["0.04%", "assurance compute vs model spend (load test)", AMBER],
  ];
  tiles.forEach((t, i) => statTile(s, MX + i * 3.12, 5.05, 2.92, 1.25, t[0], t[1], t[2]));
  s.addText("measured — reproduced by  python -m evals.run  in the public repository", {
    x: MX, y: 6.45, w: 9, h: 0.3, fontFace: F, fontSize: 10, italic: true,
    color: MUTED, margin: 0 });
  s.addText("Team Pluoton", { x: W - 3.2, y: 6.9, w: 3.2 - MX, h: 0.3, fontFace: F,
    fontSize: 11, color: TEXT, align: "right", margin: 0 });
  s.addNotes("Open on the failure: agents acting on their own fabrications. Round 1 promised inline verification; Round 2 ships and MEASURES it — and adds the episode layer nobody ships.");
  pageNo = 1;
}

// ============================================================ 2 · R1 -> R2 RECONCILIATION
{
  const s = baseSlide("Continuity, then proof",
    "Everything Round 1 promised — measured. Then the layer nobody ships.");
  const colW = (W - 2 * MX - 0.3) / 2;
  panel(s, MX, 1.5, colW, 4.1);
  sectionLabel(s, MX + 0.2, 1.66, "Round 1 · promised", MUTED);
  bullets(s, MX + 0.2, 2.0, colW - 0.4, 3.5, [
    "Tier 0–3 cascade: deterministic → small models → LLM judge → human",
    "Inline interception during streaming",
    "One decision across performance, cost and responsibility",
    "< 60 ms added p95 (Tier-0 target) · > 90% of injected failures caught",
    "< 3% of model token spend · risk × reversibility decisions",
  ]);
  panel(s, MX + colW + 0.3, 1.5, colW, 4.1, { border: SKY });
  sectionLabel(s, MX + colW + 0.5, 1.66, "Round 2 · measured on the prototype", SKY);
  bullets(s, MX + colW + 0.5, 2.0, colW - 0.4, 3.5, [
    { text: "12.6 ms p50 / 20.3 ms p95 added — full lite ensemble, not Tier-0 only", bold: true },
    { text: "96.4–100% recall per risk category, with confidence intervals", bold: true },
    { text: "0.04% of model spend (metered CPU + judge calls, load test)", bold: true },
    "Same Tier 0–3 vocabulary, same decision set: PASS · ANNOTATE · REPAIR · ESCALATE",
    "Streaming claim made precise: sentence-buffered release — PII masked before the wire; released words can't be unsaid, and we log that",
  ]);
  panel(s, MX, 5.8, W - 2 * MX, 1.15, { fill: PANEL2, border: RED });
  s.addText([
    { text: "What changed: ", options: { bold: true, color: RED } },
    { text: "inline response checking is now commodity — leading platforms ship sub-200 ms guardrails. We kept ours and stopped selling it as the innovation. Round 2's differentiator is ",
      options: { color: TEXT } },
    { text: "episode-level governance: a risk budget, claim provenance and an action gate across the whole task.",
      options: { bold: true, color: WHITE } },
  ], { x: MX + 0.25, y: 5.98, w: W - 2 * MX - 0.5, h: 0.85, fontFace: F, fontSize: 12.5, margin: 0 });
  s.addNotes("Q&A: 'Do you still stand by <60ms and >90%?' — Yes, and we beat them with the full ensemble measured, not asserted. The R1 streaming wording is corrected honestly.");
}

// ============================================================ 3 · THE PROBLEM LEFT
{
  const s = baseSlide("The gap in 2026",
    "Guardrails see requests. Risk compounds across the task.");
  const colW = 7.1;
  panel(s, MX, 1.5, colW, 2.6);
  sectionLabel(s, MX + 0.2, 1.66, "What the market already solved", MUTED);
  bullets(s, MX + 0.2, 2.0, colW - 0.4, 2.0, [
    "Response-level checks in < 200 ms, on 100% of traffic, inside your VPC — commercial platforms ship this today",
    "Policy mapping to EU AI Act, NIST AI RMF, ISO/IEC 42001 — baseline expectation",
    "Cloud providers bundle content guardrails effectively free inside existing commitments",
  ], { fontSize: 11.5 });
  panel(s, MX, 4.3, colW, 2.65, { border: RED });
  sectionLabel(s, MX + 0.2, 4.46, "What nobody governs — the brief names it", RED);
  s.addText(
    "“Multi-turn conversations and AI agents that take actions introduce compounding " +
    "risk, where one questionable output can shape several downstream decisions.”",
    { x: MX + 0.2, y: 4.78, w: colW - 0.4, h: 0.85, fontFace: F, fontSize: 12.5,
      italic: true, color: WHITE, margin: 0 });
  s.addText("— Round 2 brief, Problem Track 1. A gateway sees nine model calls; it does not see nine steps of one plan.",
    { x: MX + 0.2, y: 5.7, w: colW - 0.4, h: 1.1, fontFace: F, fontSize: 11,
      color: MUTED, margin: 0 });
  const rx = MX + colW + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 5.45, { fill: PANEL2 });
  sectionLabel(s, rx + 0.2, 1.66, "2026: agents failing in this shape", AMBER, rw - 0.4);
  bullets(s, rx + 0.2, 2.02, rw - 0.4, 4.9, [
    { text: "10 of 11 open-source coding/computer-use agents bypassed raw-string shell guards (GuardFall)", color: TEXT },
    { text: "Agent memory poisoned from a single external email (MemGhost) — one planted 'fact' steers later actions", color: TEXT },
    { text: "Defensive-review modes steered by hostile repository content (Friendly Fire)", color: TEXT },
    { text: "Only ~20% of organisations report mature AI governance (Deloitte, 2026)", color: TEXT },
    { text: "EU AI Act Art. 14 requires effective human oversight — for an agent, the episode is the only unit at which that duty is dischargeable", color: SKY, bold: true },
  ], { fontSize: 11.5, space: 8 });
  s.addNotes("The category anchor is not 'we invented episode regulation' — it is Art. 14 oversight duties plus live agent incidents. Sources: GuardFall/MemGhost/Friendly Fire 2026 agent-security research; Deloitte 2026 AI governance report.");
}

// ============================================================ 4 · REPOSITION + 3 MECHANISMS
{
  const s = baseSlide("The reposition", "");
  s.addText([
    { text: "Existing guardrails ask: ", options: { color: MUTED } },
    { text: "is this response safe?", options: { color: TEXT, italic: true } },
  ], { x: MX, y: 1.05, w: W - 2 * MX, h: 0.45, fontFace: F, fontSize: 20, margin: 0 });
  s.addText([
    { text: "ControlPlane asks: ", options: { color: MUTED } },
    { text: "is this task still safe, given everything that has already happened in it?",
      options: { color: WHITE, bold: true } },
  ], { x: MX, y: 1.55, w: W - 2 * MX, h: 0.55, fontFace: F, fontSize: 20, margin: 0 });

  const cards = [
    { c: AMBER, t: "Episode risk budget — in rupees",
      d: "Every passed-but-uncertain output debits a hazard-based expected-loss meter. When the EPISODE's cumulative risk crosses the budget, it escalates — even though no single response ever crossed a block threshold.",
      f: "escalated at turn 7 in the demo — ₹103,467 against a ₹100,000 budget" },
    { c: SKY, t: "Claim provenance & taint",
      d: "Numbers, dates, names and IDs are canonicalised — “eighty-five thousand” equals 85000. A value first appearing ungrounded in model output is tainted and tracked across every later turn. Deterministic, milliseconds, no model call.",
      f: "words → digits reformatting does not launder a fabrication" },
    { c: PURPLE, t: "Action gate on reversibility",
      d: "An irreversible tool call — pay, send, delete, submit — requires a taint-clear episode, not just clean arguments. Held BEFORE execution, with the evidence chain attached for the reviewer.",
      f: "41/41 tainted actions held · 0/47 false holds (measured)" },
  ];
  const cw = (W - 2 * MX - 0.6) / 3;
  cards.forEach((c, i) => {
    const x = MX + i * (cw + 0.3);
    panel(s, x, 2.5, cw, 4.0, { border: c.c });
    s.addText(c.t, { x: x + 0.2, y: 2.7, w: cw - 0.4, h: 0.45, fontFace: F,
      fontSize: 15, bold: true, color: c.c, margin: 0, valign: "top" });
    s.addText(c.d, { x: x + 0.2, y: 3.2, w: cw - 0.4, h: 2.4, fontFace: F,
      fontSize: 11.5, color: TEXT, margin: 0, valign: "top" });
    s.addText(c.f, { x: x + 0.2, y: 5.75, w: cw - 0.4, h: 0.6, fontFace: F,
      fontSize: 10, italic: true, color: MUTED, margin: 0 });
  });
  s.addText("Detection stays pluggable commodity — bring any guardrail vendor. The episode layer above it is the product.",
    { x: MX, y: 6.75, w: W - 2 * MX, h: 0.35, fontFace: F, fontSize: 12,
      color: MUTED, align: "center", margin: 0 });
}

// ============================================================ 5 · MECHANISM 1 — BUDGET
{
  const s = baseSlide("Mechanism 1 · episode risk budget",
    "Compounding risk, priced in expected loss — with honest math.");
  const lw = 6.0;
  panel(s, MX, 1.5, lw, 2.5);
  sectionLabel(s, MX + 0.2, 1.66, "The math (and why not a naive sum)", SKY);
  s.addText([
    { text: "h  +=  −ln(1 − p)      per category, per turn\n", options: { color: WHITE, fontSize: 13, bold: true } },
    { text: "expected loss  =  Σ (1 − e^−h) · severity₹\n\n", options: { color: WHITE, fontSize: 13, bold: true } },
    { text: "Summing per-turn expected losses can exceed the worst case: 12 turns × P=0.15 × ₹50k “accrues” ₹90k against a ₹50k maximum. Hazard math is bounded, monotone, and reads as P(≥1 real failure).",
      options: { color: MUTED, fontSize: 10.5 } },
  ], { x: MX + 0.2, y: 1.98, w: lw - 0.4, h: 1.95, fontFace: F, margin: 0, valign: "top" });

  panel(s, MX, 4.2, lw, 2.75, { fill: PANEL2 });
  sectionLabel(s, MX + 0.2, 4.36, "Engineered against the obvious attacks", MUTED);
  bullets(s, MX + 0.2, 4.7, lw - 0.4, 2.2, [
    "Verbatim restatements dedupe by content hash; taint dedupes per canonical claim",
    "Degraded detector coverage INCREASES the debit — load cannot launder risk",
    "Correlated labels (fabricated person detail = grounding + privacy) debit once, at the max — both stay on the record",
    "Identity-scoped rolling windows — splitting sessions doesn't reset the budget",
  ], { fontSize: 10.5, space: 5 });

  const rx = MX + lw + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 5.45);
  sectionLabel(s, rx + 0.2, 1.66, "Live demo trace — Act 6 (real output)", AMBER);
  const vals = [31602, 54882, 70497, 82368, 91392, 98252, 103467];
  const budget = 100000, maxV = 110000;
  const chartX = rx + 0.75, chartW = rw - 1.15, baseY = 6.1, chartH = 3.55;
  vals.forEach((v, i) => {
    const bw = chartW / vals.length - 0.12;
    const x = chartX + i * (chartW / vals.length);
    const h = (v / maxV) * chartH;
    s.addShape("roundRect", { x, y: baseY - h, w: bw, h, rectRadius: 0.03,
      fill: { color: v >= budget ? RED : AMBER }, line: { type: "none" } });
    s.addText(`T${i + 1}`, { x, y: baseY + 0.05, w: bw, h: 0.25, fontFace: F,
      fontSize: 9, color: MUTED, align: "center", margin: 0 });
    if (i === 0 || i === vals.length - 1)
      s.addText(`₹${Math.round(v / 1000)}k`, { x: x - 0.15, y: baseY - h - 0.3,
        w: bw + 0.3, h: 0.25, fontFace: F, fontSize: 9.5, bold: true,
        color: v >= budget ? RED : TEXT, align: "center", margin: 0 });
  });
  const budgetY = baseY - (budget / maxV) * chartH;
  s.addShape("line", { x: chartX - 0.1, y: budgetY, w: chartW + 0.2, h: 0,
    line: { color: RED, width: 1.25, dashType: "dash" } });
  s.addText("budget ₹100,000", { x: chartX - 0.12, y: budgetY - 0.27, w: 2, h: 0.22,
    fontFace: F, fontSize: 9, color: RED, margin: 0 });
  s.addText("“Provisional figures” from a low-trust source, turn after turn. Turns 1–6: ANNOTATE — none crosses a block threshold. Turn 7: the episode's budget exhausts and it escalates.",
    { x: rx + 0.2, y: 6.35, w: rw - 0.4, h: 0.55, fontFace: F, fontSize: 10,
      italic: true, color: MUTED, margin: 0 });
  s.addNotes("Q&A: 'where do the probabilities come from?' — isotonic calibration on an eval hold-out, prior-shifted to a stated deployment base rate; thresholds use detection confidence, the ₹ ledger uses the shifted probability. Severities are the client risk office's signed numbers, not ours.");
}

// ============================================================ 6 · MECHANISM 2 — TAINT
{
  const s = baseSlide("Mechanism 2 · claim provenance",
    "Canonical values, not strings — reformatting doesn't launder a fabrication.");
  const lw = 6.4;
  panel(s, MX, 1.5, lw, 1.7);
  sectionLabel(s, MX + 0.2, 1.66, "One canonical value", SKY);
  s.addText([
    { text: "₹1,20,000  =  120000  =  1.2 lakh  =  one point two lakh\n", options: { color: WHITE, fontSize: 14, bold: true } },
    { text: "dates → ISO · names casefolded, honorifics stripped · IDs normalised · tolerance matching survives rounding", options: { color: MUTED, fontSize: 10.5 } },
  ], { x: MX + 0.2, y: 1.95, w: lw - 0.4, h: 1.1, fontFace: F, margin: 0 });

  panel(s, MX, 3.4, lw, 3.55, { fill: PANEL2 });
  sectionLabel(s, MX + 0.2, 3.56, "Every value gets a provenance class", MUTED);
  const classes = [
    ["GROUNDED", GREEN, "found in a well-governed source or the user's own input"],
    ["DERIVED", SKY, "computable from grounded numbers — sums, GST, discounts — whitelisted, logged with its formula (models legitimately derive; tainting derivations would flood the gate)"],
    ["LOW-TRUST", AMBER, "supported ONLY by a loosely-governed source — shared drive, forwarded email, agent memory. The brief's own data-quality split; the MemGhost defence"],
    ["TAINTED", RED, "first appeared in model output with no support anywhere"],
  ];
  let cy = 3.9;
  classes.forEach(([name, color, desc]) => {
    s.addShape("roundRect", { x: MX + 0.2, y: cy, w: 1.35, h: 0.34, rectRadius: 0.06,
      fill: { color: PANEL }, line: { color, width: 1 } });
    s.addText(name, { x: MX + 0.2, y: cy, w: 1.35, h: 0.34, fontFace: F, fontSize: 9.5,
      bold: true, color, align: "center", valign: "middle", margin: 0 });
    s.addText(desc, { x: MX + 1.72, y: cy - 0.05, w: lw - 2.0, h: 0.78, fontFace: F,
      fontSize: 10, color: TEXT, margin: 0, valign: "top" });
    cy += 0.78;
  });

  const rx = MX + lw + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 5.45, { border: SKY });
  sectionLabel(s, rx + 0.2, 1.66, "Why this design survives the Q&A", SKY);
  bullets(s, rx + 0.2, 2.05, rw - 0.4, 4.6, [
    { text: "“What if the agent writes the number in words?” — canonicalisation catches it; the demo does exactly this", bold: true },
    "Deterministic fast path on 100% of traffic: entity/number/date tracking is regex + parsing, milliseconds, zero model calls",
    "Full semantic claim extraction (LLM) runs only on already-elevated episodes — we say this trade-off out loud",
    "The same-claim-restated case dedupes; the recombined-entities case is honestly out of the lexical path's scope — it belongs to the NLI adapter and Tier-2 judge",
    "A claim a human verifies can be RESOLVED — the taint clears, the action re-proposes, everything ledgered",
  ], { fontSize: 11, space: 9 });
}

// ============================================================ 7 · MECHANISM 3 — GATE (FLAGSHIP)
{
  const s = baseSlide("Mechanism 3 · the action gate",
    "Held before execution — the shot response-level tools cannot take.");
  panel(s, MX, 1.5, W - 2 * MX, 2.9, { border: PURPLE });
  sectionLabel(s, MX + 0.2, 1.64, "The flagship demo trace (deterministic, offline, in the repo)", PURPLE);
  const steps = [
    ["TURN 1", "“Prepare claim CLM-20391 for payout” — source says approved: ₹45,000", GREEN, "grounded"],
    ["TURN 2", "model: “payable amount comes to eighty-five thousand rupees”", RED, "TAINTED — not in any source, not derivable"],
    ["TURN 3", "tool call: issue_refund(claim=CLM-20391, amount=85000)", PURPLE, "HOLD_ACTION — canonical match, words = digits"],
  ];
  const sw = (W - 2 * MX - 0.4 - 0.7) / 3;
  steps.forEach(([label, text, color, verdict], i) => {
    const x = MX + 0.2 + i * (sw + 0.35);
    panel(s, x, 2.05, sw, 2.1, { fill: PANEL2, border: color });
    s.addText(label, { x: x + 0.15, y: 2.18, w: sw - 0.3, h: 0.3, fontFace: F,
      fontSize: 10, bold: true, color, charSpacing: 2, margin: 0 });
    s.addText(text, { x: x + 0.15, y: 2.5, w: sw - 0.3, h: 1.0, fontFace: F,
      fontSize: 10.5, color: TEXT, margin: 0 });
    s.addText(verdict, { x: x + 0.15, y: 3.6, w: sw - 0.3, h: 0.45, fontFace: F,
      fontSize: 10, bold: true, color, margin: 0 });
    if (i < 2) s.addText("→", { x: x + sw + 0.02, y: 2.85, w: 0.32, h: 0.4,
      fontFace: F, fontSize: 18, color: MUTED, align: "center", margin: 0 });
  });

  const half = (W - 2 * MX - 0.3) / 2;
  panel(s, MX, 4.65, half, 2.3);
  sectionLabel(s, MX + 0.2, 4.8, "The harder case: clean args, tainted premise", RED);
  s.addText(
    "Turn 1: model claims “the customer's balance fully covers this, at ₹9,90,000” (fabricated). " +
    "Turn 2: transfer_funds(amount=45000) — every argument pristine, the adjudicated amount itself.",
    { x: MX + 0.2, y: 5.12, w: half - 0.4, h: 0.95, fontFace: F, fontSize: 10.5, color: TEXT, margin: 0 });
  s.addText("Still held. Irreversible actions require a taint-clear EPISODE — we cannot read the model's reasoning (API-only access), so the episode's evidence state must be clean. Conservative by construction.",
    { x: MX + 0.2, y: 6.1, w: half - 0.4, h: 0.8, fontFace: F, fontSize: 10.5,
      bold: true, color: WHITE, margin: 0 });
  const rx = MX + half + 0.3;
  panel(s, rx, 4.65, half, 2.3, { fill: PANEL2 });
  sectionLabel(s, rx + 0.2, 4.8, "Measured on 88 held-out agent episodes (of 120 generated)", GREEN, half - 0.4);
  const gm = [
    ["41/41", "tainted irreversible actions held (95% CI [91.4, 100])", PURPLE],
    ["0/47", "false holds on clean episodes — the alert-fatigue answer", GREEN],
  ];
  gm.forEach((t, i) => statTile(s, rx + 0.2 + i * ((half - 0.55) / 2 + 0.15), 5.15,
    (half - 0.55) / 2, 1.15, t[0], t[1], t[2]));
  s.addText("Reversible actions (lookups, drafts) pass despite taint — reversibility is the dial.",
    { x: rx + 0.2, y: 6.42, w: half - 0.4, h: 0.45, fontFace: F, fontSize: 10,
      italic: true, color: MUTED, margin: 0 });
}

// ============================================================ 8 · ARCHITECTURE
{
  const s = baseSlide("Architecture", "A gateway you adopt by changing one line: base_url.");
  const stages = [
    ["INGRESS GATE", "injection — direct AND inside retrieved sources · input PII · before any model call", PURPLE, 1.62],
    ["TIERED DETECTION", "Tier 0 <1 ms deterministic, 100%, never sheds · Tier 1 lexical/ONNX under the lane's latency budget · Tier 2 LLM judge, elevated episodes only → honest coverage score", SKY, 2.42],
    ["RISK FUSION", "isotonic calibration per detector → noisy-OR per category → correlated clusters debit once", TEXT, 3.22],
    ["EPISODE LEDGER", "₹ hazard budget · canonical claim taint · action gate · identity windows", RED, 4.02],
    ["POLICY ENGINE", "versioned, hashed, signed YAML packs · hot reload · anti-rollback · jurisdiction overlays", AMBER, 4.82],
    ["DECISION", "PASS · ANNOTATE · REPAIR (deterministic: mask PII, hedge claims) · ESCALATE · BLOCK · HOLD_ACTION", GREEN, 5.62],
    ["EVIDENCE", "hash-chained ledger, keyed HMAC digests (no raw text), external anchors · quarantined feedback store → retune", MUTED, 6.42],
  ];
  const lw2 = 7.9;
  stages.forEach(([name, desc, color, y]) => {
    panel(s, MX, y, lw2, 0.7, { fill: PANEL, border: BORDER });
    s.addText(name, { x: MX + 0.18, y: y + 0.08, w: 1.85, h: 0.54, fontFace: F,
      fontSize: 10, bold: true, color, valign: "middle", margin: 0 });
    s.addText(desc, { x: MX + 2.05, y: y + 0.06, w: lw2 - 2.2, h: 0.58, fontFace: F,
      fontSize: 9, color: TEXT, valign: "middle", margin: 0 });
  });
  const rx = MX + lw2 + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.62, rw, 2.5, { fill: PANEL2 });
  sectionLabel(s, rx + 0.18, 1.76, "Measured tiers (this hardware)", SKY);
  const tierRows = [
    ["Tier 0", "regex/checksum/signatures", "< 1 ms"],
    ["Tier 1", "lexical grounding, name-context, lexicons", "1–5 ms"],
    ["Tier 1+", "ONNX NLI + toxicity (optional)", "measured at warmup"],
    ["Tier 2", "LLM judge, elevated only", "~400 ms"],
  ];
  let ty = 2.1;
  tierRows.forEach(([a, b, c]) => {
    s.addText(a, { x: rx + 0.18, y: ty, w: 0.7, h: 0.42, fontFace: F, fontSize: 9.5, bold: true, color: WHITE, margin: 0 });
    s.addText(b, { x: rx + 0.92, y: ty, w: rw - 2.0, h: 0.42, fontFace: F, fontSize: 9, color: TEXT, margin: 0 });
    s.addText(c, { x: rx + rw - 1.15, y: ty, w: 1.0, h: 0.42, fontFace: F, fontSize: 9, color: MUTED, align: "right", margin: 0 });
    ty += 0.47;
  });
  s.addText("NER-based PII is honestly Tier 1 — not a <5 ms claim.",
    { x: rx + 0.18, y: ty + 0.02, w: rw - 0.36, h: 0.24, fontFace: F, fontSize: 8.5, italic: true, color: MUTED, margin: 0 });
  panel(s, rx, 4.45, rw, 2.67, { fill: PANEL2 });
  sectionLabel(s, rx + 0.18, 4.59, "One engine, three modes", AMBER);
  bullets(s, rx + 0.18, 4.93, rw - 0.36, 2.1, [
    { text: "GATE — block-capable; withholds tool calls (agents)", color: SKY },
    { text: "INLINE — annotate / repair / stream (chat, copilot)", color: AMBER },
    { text: "AUDIT — shadow: observe + ledger only. This is Phase 0 and the offline log-replay assessment", color: GREEN },
    { text: "Checker faults are policy: chat fails open (annotated), regulated lanes fail closed", color: TEXT },
  ], { fontSize: 10, space: 7 });
}

// ============================================================ 9 · POLICY IS DATA
{
  const s = baseSlide("Policy is data",
    "Three lanes, one engine — and geography is an API call, not a release.");
  const lanes = [
    ["Customer support", "150 ms budget · inline · fail-open", "PII repaired mid-stream, sentence-buffered release; brand/toxicity blocked; coverage score reported", GREEN],
    ["Internal copilot", "1.5 s budget · inline · fail-open", "grounding vs governed + loosely-governed sources; abstains on no evidence; low-trust support annotated with provenance", AMBER],
    ["Decision-support agent", "10 s budget · GATE · fail-closed", "episode budget, claim taint, action gate; irreversible tools registered in the pack; nothing unchecked delivered", RED],
  ];
  const cw = (W - 2 * MX - 0.6) / 3;
  lanes.forEach(([name, spec, desc, color], i) => {
    const x = MX + i * (cw + 0.3);
    panel(s, x, 1.5, cw, 2.45, { border: color });
    s.addText(name, { x: x + 0.18, y: 1.66, w: cw - 0.36, h: 0.4, fontFace: F, fontSize: 13.5, bold: true, color: WHITE, margin: 0 });
    s.addText(spec, { x: x + 0.18, y: 2.06, w: cw - 0.36, h: 0.3, fontFace: F, fontSize: 10, bold: true, color, margin: 0 });
    s.addText(desc, { x: x + 0.18, y: 2.42, w: cw - 0.36, h: 1.4, fontFace: F, fontSize: 10, color: TEXT, margin: 0 });
  });
  panel(s, MX, 4.2, 7.3, 2.75, { border: SKY });
  sectionLabel(s, MX + 0.2, 4.36, "The 20-second live moment (demo Act 5)", SKY);
  s.addText([
    { text: "Same episode, same content: ", options: { color: TEXT, fontSize: 12 } },
    { text: "a payout figure supported only by a forwarded email.\n\n", options: { color: TEXT, fontSize: 12 } },
    { text: "IN pack (DPDP posture) → transfer_funds HELD\n", options: { color: RED, fontSize: 13.5, bold: true } },
    { text: "switch jurisdiction to US — one API call, version bumps, hot-reloads\n", options: { color: MUTED, fontSize: 10.5, italic: true } },
    { text: "US pack (low-trust tolerated by policy) → transfer_funds PASSES", options: { color: GREEN, fontSize: 13.5, bold: true } },
  ], { x: MX + 0.2, y: 4.7, w: 6.9, h: 2.1, fontFace: F, margin: 0, valign: "top" });
  const rx = MX + 7.6, rw = W - MX - rx;
  panel(s, rx, 4.2, rw, 2.75, { fill: PANEL2 });
  sectionLabel(s, rx + 0.18, 4.36, "Governance hardening", MUTED);
  bullets(s, rx + 0.18, 4.7, rw - 0.36, 2.15, [
    "Every decision records policy_version + pack_hash",
    "Anti-rollback: an older validly-signed pack is refused",
    "Unparseable pack → last-known-good keeps serving",
    "Operating point is an owned dial: set a benign-flag-rate target, thresholds solve from the measured sweep",
  ], { fontSize: 10, space: 6 });
}

// ============================================================ 10 · MEASURED RESULTS
{
  const s = baseSlide("Measured, not asserted",
    "Every number reproduced by  python -m evals.run  — counts and intervals included.");
  const rows = [
    [{ text: "Risk category", options: { bold: true } }, { text: "Recall (caught / injected)", options: { bold: true } }, { text: "95% CI", options: { bold: true } }, { text: "False flags on benign", options: { bold: true } }],
    ["Grounding (unsupported assertion)", "96.4%  (402 / 417)", "[94.2, 97.8]", "0 / 1,964"],
    ["Privacy (PII)", "100%  (132 / 132)", "[97.2, 100]", "0 / 2,249"],
    ["Toxicity / harmful language", "100%  (96 / 96)", "[96.2, 100]", "0 / 2,285"],
    ["Prompt injection (incl. indirect)", "100%  (68 / 68)", "[94.7, 100]", "0 / 2,313"],
    ["Cost anomalies", "100%  (26 / 26)", "[87.1, 100]", "0 / 2,355"],
  ];
  s.addTable(rows.map(r => r.map(c => typeof c === "string"
      ? { text: c, options: { color: TEXT, fontSize: 10.5 } }
      : { text: c.text, options: { ...c.options, color: WHITE, fontSize: 10.5 } })), {
    x: MX, y: 1.55, w: 7.4, colW: [2.85, 2.0, 1.15, 1.4],
    border: { type: "solid", color: BORDER, pt: 0.5 },
    fill: { color: PANEL }, fontFace: F, rowH: 0.38, valign: "middle", margin: 0.06,
  });
  s.addText("Test split (2,381 records) of a 3,488-record seeded synthetic dataset (~28% injected failures — labels true by construction; archetypes follow HaluEval/RAGTruth, JailbreakBench, Presidio patterns). The 15 grounding misses are entity-less recombinations — the stated limit of the deterministic path; that is what the NLI adapter and Tier-2 judge are for.",
    { x: MX, y: 4.35, w: 7.4, h: 1.0, fontFace: F, fontSize: 9.5, color: MUTED, margin: 0 });
  panel(s, MX, 5.45, 7.4, 1.5, { fill: PANEL2, border: AMBER });
  s.addText([
    { text: "Said before you ask: ", options: { bold: true, color: AMBER } },
    { text: "these are rates on synthetic traffic with failures injected by construction. Real-traffic rates are established in the shadow phase — that is what the shadow phase is FOR. A blind hold-out slot (written by whoever didn't build the detectors) is in the repo and scored separately.",
      options: { color: TEXT } },
  ], { x: MX + 0.2, y: 5.62, w: 7.0, h: 1.2, fontFace: F, fontSize: 10.5, margin: 0 });

  const rx = MX + 7.7, rw = W - MX - rx;
  const tiles = [
    ["43/43", "correct abstentions — INSUFFICIENT_EVIDENCE, never an invented score", SKY],
    ["0.065", "expected calibration error (reliability diagram on the dashboard)", TEXT],
    ["12.6 ms", "p50 added per request (p95 20.3 ms, ~250-token responses)", GREEN],
    ["108 req/s", "single instance at saturation · 0 errors · stateless scale-out", WHITE],
    ["0.04%", "assurance vs model spend — load test; 0.2% on the failure-rich eval mix", AMBER],
    [">96%", "of traffic checked with no LLM call at all", PURPLE],
  ];
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    statTile(s, rx + col * ((rw - 0.15) / 2 + 0.15), 1.55 + row * 1.85,
      (rw - 0.15) / 2, 1.7, t[0], t[1], t[2]);
  });
}

// ============================================================ 11 · THE PROTOTYPE
{
  const s = baseSlide("The prototype you can run",
    "docker compose up — fully offline, no keys, no model downloads.");
  const lw = 6.1;
  panel(s, MX, 1.5, lw, 5.45, { fill: PANEL2 });
  sectionLabel(s, MX + 0.2, 1.66, "The 10-act scripted demo (deterministic)", SKY);
  bullets(s, MX + 0.2, 2.02, lw - 0.4, 4.85, [
    "PII masked mid-stream — sentence-buffered release",
    "Honest abstention · governed-vs-loosely-governed source split",
    "Words-vs-digits taint catch → issue_refund HELD before execution",
    "Audit-mode side-by-side: what “off” looks like — the payout executes",
    "IN → US jurisdiction flip reverses the gate outcome, no restart",
    "Budget exhaustion at turn 7 — compounding, not thresholds",
    "Two-person override (self-approval refused) + overturn-rate watch",
    "Checker crash: chat fails open, regulated lane fails closed",
    "Indirect injection inside a poisoned document — blocked at ingress",
    "Hash-chain verification, telemetry, LLM-vs-non-LLM split, cost meter",
  ], { fontSize: 10.5, space: 5 });
  panel(s, MX + 0.2, 5.35, lw - 0.4, 1.35, { fill: "0A0E13", border: BORDER });
  s.addText([
    { text: "git clone <repo> && cd controlplane\n", options: { color: MUTED } },
    { text: "docker compose up --build", options: { color: GREEN, bold: true } },
    { text: "        # gateway + dashboard :8080\n", options: { color: MUTED } },
    { text: "python -m demo.run_demo", options: { color: SKY, bold: true } },
    { text: "          # the 10 acts, offline\n", options: { color: MUTED } },
    { text: "python -m evals.run", options: { color: AMBER, bold: true } },
    { text: "              # reproduce every number", options: { color: MUTED } },
  ], { x: MX + 0.4, y: 5.5, w: lw - 0.8, h: 1.1, fontFace: "Courier New",
    fontSize: 10.5, margin: 0, valign: "top" });
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 3.6);
  sectionLabel(s, rx + 0.2, 1.66, "Operator console (React)", AMBER, rw - 0.4);
  s.addText("live decision feed · episode inspector with ₹ budget gauge, hazard bars, claims & gate events · operating-point console over the measured sweep · eval scoreboard with reliability diagram · policy-pack cards with live jurisdiction switch · override queue",
    { x: rx + 0.2, y: 2.0, w: rw - 0.4, h: 0.95, fontFace: F, fontSize: 10.5, color: TEXT, margin: 0, valign: "top" });
  s.addImage({ path: "dashboard_top.png", x: rx + 0.28, y: 2.98, w: 4.3, h: 2.06 });
  panel(s, rx, 5.3, rw, 1.65, { fill: PANEL2 });
  sectionLabel(s, rx + 0.2, 5.44, "Repo discipline", MUTED);
  bullets(s, rx + 0.2, 5.76, rw - 0.4, 1.1, [
    "24 tests · seeded dataset · every deck number scripted",
    "Apache-2.0 · NOTICE with model/benchmark attribution",
    "Replay-first: the stage demo survives venue Wi-Fi",
  ], { fontSize: 10, space: 4 });
}

// ============================================================ 12 · COMPETITION
{
  const s = baseSlide("Competitive landscape",
    "They are excellent at responses. The episode is unclaimed.");
  const rows = [
    [{ text: "Player", options: { bold: true } }, { text: "What they do well (credited)", options: { bold: true } }, { text: "Where the ceiling is", options: { bold: true } }],
    ["Fiddler · Galileo · Arthur", "in-VPC small-model checks on 100% of traffic; sub-200 ms guardrails; session observability", "requests, not reasoning — no cumulative ₹ risk, no provenance-gated actions. Observability after the fact ≠ enforcement before the irreversible call"],
    ["Hyperscaler guardrails (Bedrock, Azure)", "content safety effectively free inside existing cloud commitments — the real pricing threat", "per-response, single-cloud; no cross-vendor evidence ledger, no episode state"],
    ["AI gateways (LiteLLM, Portkey)", "routing, quotas, guardrail hooks at the proxy", "plumbing, not governance — no calibrated decisions, no audit-grade ledger"],
  ];
  s.addTable(rows.map(r => r.map(c => typeof c === "string"
      ? { text: c, options: { color: TEXT, fontSize: 10.5 } }
      : { text: c.text, options: { ...c.options, color: WHITE, fontSize: 11 } })), {
    x: MX, y: 1.5, w: W - 2 * MX, colW: [2.6, 4.5, 5.13],
    border: { type: "solid", color: BORDER, pt: 0.5 },
    fill: { color: PANEL }, fontFace: F, valign: "top", margin: 0.09, autoPage: false,
  });
  panel(s, MX, 4.35, W - 2 * MX, 1.75, { border: SKY });
  s.addText([
    { text: "Positioning: the neutral episode & evidence layer ABOVE whatever detectors the client already gets — including free ones. ",
      options: { bold: true, color: WHITE, fontSize: 12.5 } },
    { text: "Detectors are pluggable adapters; commoditised detection makes the governance layer MORE valuable, not less. “Galileo ships session metrics” → session observability after the fact vs episode enforcement before the irreversible action — the demo's held tool call is the proof. And an episode ledger is a fast-follow for them only if they abandon per-response pricing and architecture — our moat is the unit of account.",
      options: { color: TEXT, fontSize: 11 } },
  ], { x: MX + 0.22, y: 4.52, w: W - 2 * MX - 0.44, h: 1.45, fontFace: F, margin: 0 });
  s.addText([
    { text: "Prepared for the obvious probe — ", options: { bold: true, color: AMBER, fontSize: 11 } },
    { text: "“Why wouldn't the client just buy them?” They can. Bring-your-own-detector is a feature: the assessment, the signed severity table, the episode ledger and the operating methodology are what Accenture sells on top.",
      options: { color: TEXT, fontSize: 11 } },
  ], { x: MX + 0.22, y: 6.35, w: W - 2 * MX - 0.44, h: 0.7, fontFace: F, margin: 0 });
}

// ============================================================ 13 · BUSINESS MODEL
{
  const s = baseSlide("Business model",
    "Accenture's own motion: assess → deploy → run. Priced on the unit we govern.");
  panel(s, MX, 1.45, W - 2 * MX, 0.85, { fill: PANEL2 });
  s.addText([
    { text: "Economic buyer: ", options: { bold: true, color: WHITE } },
    { text: "CIO / Head of AI Platform — with the CRO as co-sponsor whose regulatory pressure creates urgency. Engineering, FinOps and operations are stakeholders to neutralise (latency, cost, alert fatigue), not signatures to collect.",
      options: { color: TEXT } },
  ], { x: MX + 0.2, y: 1.58, w: W - 2 * MX - 0.4, h: 0.6, fontFace: F, fontSize: 11.5, margin: 0 });
  const phases = [
    ["LAND", "Assurance Assessment — 4–6 weeks, fixed fee", "Runs in AUDIT mode over exported LLM logs — zero production footprint, no InfoSec cliff before week 1. Deliverables: the episode risk report no incumbent can produce, and the client-signed severity table (their risk office signs the ₹ numbers — we never invent them).", GREEN],
    ["EXPAND", "In-tenancy deployment", "Priced per governed use case / agent class per month, tiered by risk class and jurisdiction count. Request metering is a fair-use throttle, not the headline. Assurance COGS ≈ 0.04% of model spend is the margin story, never the price anchor.", SKY],
    ["RUN", "Managed assurance service", "The escalation triage bench (L1/L2/L3), quarterly policy-pack updates, drift recalibration against a frozen canary set. The human-review labour IS the recurring service line — priced in, not hidden from the ROI.", AMBER],
  ];
  const cw = (W - 2 * MX - 0.6) / 3;
  phases.forEach(([tag, name, desc, color], i) => {
    const x = MX + i * (cw + 0.3);
    panel(s, x, 2.5, cw, 3.3, { border: color });
    s.addText(tag, { x: x + 0.18, y: 2.66, w: cw - 0.36, h: 0.3, fontFace: F,
      fontSize: 11, bold: true, color, charSpacing: 3, margin: 0 });
    s.addText(name, { x: x + 0.18, y: 2.98, w: cw - 0.36, h: 0.55, fontFace: F,
      fontSize: 12.5, bold: true, color: WHITE, margin: 0 });
    s.addText(desc, { x: x + 0.18, y: 3.56, w: cw - 0.36, h: 2.1, fontFace: F,
      fontSize: 10, color: TEXT, margin: 0 });
  });
  panel(s, MX, 6.0, W - 2 * MX, 1.0, { fill: PANEL2, border: BORDER });
  s.addText([
    { text: "Worked example at the brief's own volume (2.1M interactions/yr, 3 use cases): ", options: { bold: true, color: WHITE } },
    { text: "3 × ₹5L platform + ₹10L managed service (incl. the triage bench) ≈ ₹25L/yr per client — against ₹1.2Cr+ modelled avoided loss (next slide). Why Accenture builds it: this productises what the Responsible AI practice already does manually — thousands of GenAI engagements are the install base.",
      options: { color: TEXT } },
  ], { x: MX + 0.2, y: 6.14, w: W - 2 * MX - 0.4, h: 0.75, fontFace: F, fontSize: 11, margin: 0 });
}

// ============================================================ 14 · ROI
{
  const s = baseSlide("The business case",
    "A floor you can defend, a band you can believe — assumptions on the slide.");
  const lw = 7.0;
  panel(s, MX, 1.5, lw, 3.3);
  sectionLabel(s, MX + 0.2, 1.66, "Floor case — remediation only, zero regulatory term", GREEN);
  const roiRows = [
    ["Volume (brief parameter)", "40,000 interactions/week ≈ 2.1M/yr"],
    ["Material-failure rate (assumed → measured in shadow)", "1.0%"],
    ["Catch rate (measured on benchmark)", "95%"],
    ["Cost per failure reaching a user (remediation + concession)", "₹600"],
    [{ text: "Avoided loss floor", options: { bold: true } }, { text: "≈ ₹1.2 Cr / yr", options: { bold: true } }],
    ["All-in assurance cost: 3 × ₹5L platform + ₹10L managed service — which INCLUDES the triage bench (0.4% escalation rate × 2.1M = 8,400/yr × 10 min × ₹500/hr ≈ ₹7L)", "≈ ₹25L / yr"],
    [{ text: "ROI floor", options: { bold: true } }, { text: "≈ 4.8×  before any regulatory term", options: { bold: true } }],
  ];
  s.addTable(roiRows.map(r => r.map(c => typeof c === "string"
      ? { text: c, options: { color: TEXT, fontSize: 10 } }
      : { text: c.text, options: { ...c.options, color: GREEN, fontSize: 10.5 } })), {
    x: MX + 0.2, y: 2.0, w: lw - 0.4, colW: [4.4, 2.2],
    border: { type: "solid", color: BORDER, pt: 0.5 }, fill: { color: PANEL2 },
    fontFace: F, valign: "middle", margin: 0.05, autoPage: false,
  });
  panel(s, MX, 5.0, lw, 1.95, { fill: PANEL2, border: AMBER });
  sectionLabel(s, MX + 0.2, 5.15, "Scenario band — shown separately, never blended in", AMBER);
  s.addText(
    "Probability-weighted regulatory and brand exposure (DPDP Act obligations for personal-data safeguards; incident disclosure; goodwill) adds a modelled ₹30L–₹1.5Cr expected term. We never anchor on the statutory ceiling — multiplying a tiny probability by a maximum penalty is fear math a CFO discounts on sight.",
    { x: MX + 0.2, y: 5.48, w: lw - 0.4, h: 1.35, fontFace: F, fontSize: 10.5, color: TEXT, margin: 0 });
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 5.45, { border: GREEN });
  sectionLabel(s, rx + 0.2, 1.66, "Why this survives a CFO", GREEN);
  bullets(s, rx + 0.2, 2.02, rw - 0.4, 4.8, [
    { text: "Every input is on the slide — attack the assumption, not the method", bold: true },
    "The failure rate is not ours to claim: Phase 0 shadow mode measures it on the client's own traffic",
    "The severity table is not ours to invent: the client's risk office signs it during the assessment — that signature makes the episode budget THEIR number",
    "Triage labour sits inside the denominator — the ROI is net of the humans",
    "The assurance meter and the episode budget are the same ₹ machinery: the ROI dashboard is the product, not a spreadsheet",
  ], { fontSize: 10.5, space: 8 });
}

// ============================================================ 15 · ROADMAP + RISKS
{
  const s = baseSlide("Roadmap & risks",
    "The episode layer exists from day zero. Phases gate enforcement authority, not capability.");
  const phases = [
    ["0 · OBSERVE", "wk 0–6", "audit mode on exported logs / shadow: full episode ledger runs, zero enforcement. Outputs: FP/FN baseline, benign-episode budget calibration, episode risk report", GREEN],
    ["1 · ENFORCE RESPONSES", "wk 6–14", "one use case, conservative operating point set on the console; overrides start feeding retune", SKY],
    ["2 · ENFORCE EPISODES & ACTIONS", "mo 4–8", "budgets + action gate get block/hold authority on the regulated lane; two-person override live", RED],
    ["3 · ESTATE", "mo 8–18", "all use cases, jurisdiction packs, detector-adapter marketplace (bring your own vendor), cross-estate identity windows", AMBER],
  ];
  const cw = (W - 2 * MX - 0.9) / 4;
  phases.forEach(([tag, when, desc, color], i) => {
    const x = MX + i * (cw + 0.3);
    panel(s, x, 1.5, cw, 2.6, { border: color });
    s.addText(tag, { x: x + 0.15, y: 1.64, w: cw - 0.3, h: 0.5, fontFace: F,
      fontSize: 10.5, bold: true, color, margin: 0 });
    s.addText(when, { x: x + 0.15, y: 2.12, w: cw - 0.3, h: 0.28, fontFace: F,
      fontSize: 9.5, bold: true, color: MUTED, margin: 0 });
    s.addText(desc, { x: x + 0.15, y: 2.44, w: cw - 0.3, h: 1.6, fontFace: F,
      fontSize: 9, color: TEXT, margin: 0 });
  });
  const risks = [
    ["False-positive fatigue", "shadow first · operating point is the client's dial · 0/47 false holds measured · overturn-rate watch"],
    ["Latency regression", "budget scheduler with per-detector timeouts · honest coverage score · measured 12.6/20.3 ms"],
    ["Checker fails or is attacked", "fail-open/closed per lane · Tier 0 never sheds · ingress gate · GuardFall-informed red-teaming"],
    ["Detector drift / vendor change", "weekly recalibration vs frozen canary set · model fingerprint on every decision"],
    ["Ledger becomes a privacy liability", "keyed HMAC digests, no raw text · split quarantined feedback store · retention policy"],
    ["Fast-follow by incumbents", "moat is the unit of account + the signed severity methodology + Accenture's delivery install base"],
  ];
  s.addTable(risks.map(r => [
    { text: r[0], options: { color: WHITE, fontSize: 10, bold: true } },
    { text: r[1], options: { color: TEXT, fontSize: 10 } },
  ]), {
    x: MX, y: 4.4, w: W - 2 * MX, colW: [3.3, 8.93],
    border: { type: "solid", color: BORDER, pt: 0.5 }, fill: { color: PANEL },
    fontFace: F, valign: "middle", margin: 0.06, autoPage: false,
  });
}

// ============================================================ 16 · COVERAGE + SCOPE + CLOSE
{
  const s = baseSlide("Complete coverage, stated scope",
    "Every brief requirement has a mechanism. Every boundary is ours, said first.");
  const cov = [
    ["Different risk/latency budgets per use case", "policy packs + budget scheduler + coverage score"],
    ["Overlapping risk categories", "multi-label vector; correlated clusters — two labels, one debit (132/132)"],
    ["No reliable real-time ground truth", "unsupported-assertion detection + first-class abstention (43/43)"],
    ["Over- vs under-flagging tradeoff", "operating-point console over the measured sweep; 0 false flags at chosen point"],
    ["Multi-turn & agent compounding risk", "₹ episode budget · claim taint · action gate (41/41, 0/47)"],
    ["Evolving regulation by geography", "jurisdiction overlays, hot-reload, versioned + hashed + anti-rollback"],
    ["API-only model access", "pure I/O layer; opportunistic logprobs recorded in the fingerprint, never faked"],
    ["Governance & audit trail", "hash-chained HMAC ledger, external anchors, two-person overrides"],
    ["Feedback loops", "quarantined override store → threshold retune → before/after on the dashboard"],
    ["Metrics for a sceptical stakeholder", "counts + Wilson CIs + ECE + reliability diagram + reproduction scripts"],
  ];
  s.addTable(cov.map(r => [
    { text: r[0], options: { color: WHITE, fontSize: 9.5, bold: true } },
    { text: r[1], options: { color: TEXT, fontSize: 9.5 } },
  ]), {
    x: MX, y: 1.5, w: 7.6, colW: [3.1, 4.5],
    border: { type: "solid", color: BORDER, pt: 0.5 }, fill: { color: PANEL },
    fontFace: F, valign: "middle", margin: 0.05, autoPage: false,
  });
  const rx = MX + 7.9, rw = W - MX - rx;
  panel(s, rx, 1.5, rw, 3.4, { fill: PANEL2, border: AMBER });
  sectionLabel(s, rx + 0.2, 1.66, "What it deliberately does not do", AMBER);
  bullets(s, rx + 0.2, 2.0, rw - 0.4, 2.8, [
    "Verify truth — we detect unsupported assertion and abstain",
    "Inspect model internals — API-only is the brief's constraint",
    "Train custom detectors — adapters are commodity; governance is the IP",
    "Claim benchmarked bias detection — the heuristic can annotate, never block; said out loud",
  ], { fontSize: 10, space: 7 });
  panel(s, rx, 5.1, rw, 1.85, { border: SKY });
  s.addText([
    { text: "The one-line close\n", options: { bold: true, color: SKY, fontSize: 11 } },
    { text: "Every AI programme already checks its responses. Nobody governs its tasks. ControlPlane is the control point at the only moment that matters — before the irreversible action.",
      options: { color: WHITE, fontSize: 12.5, bold: true } },
  ], { x: rx + 0.2, y: 5.28, w: rw - 0.4, h: 1.5, fontFace: F, margin: 0 });
}

pres.writeFile({ fileName: "ControlPlane_Round2.pptx" }).then(() => {
  console.log("wrote ControlPlane_Round2.pptx");
});

// ControlPlane - Detailed Business Proposal (case-competition edition)
// Light consulting-style deck: action titles, native charts, flow diagrams,
// competitive matrix, gantt roadmap. Every number reproduced by controlplane/evals.
const pptxgen = require("pptxgenjs");

// ---- palette (light, Accenture-flavoured) ----
const BGC = "FFFFFF";
const INK = "1E1E28", MUTED = "6A6E78", FAINT = "9AA0AA";
const PURPLE = "A100FF", DEEP = "460073", MIDP = "7500C0";
const TINT = "F6EFFF", TINT2 = "FBF8FF", BORDER = "E4DCEF";
const GREEN = "188038", GREENT = "E6F4EA";
const RED = "C5221F", REDT = "FCE8E6";
const AMBER = "B26A00", AMBERT = "FEF3E0";
const BLUE = "1A73E8", BLUET = "E8F0FE";
const F = "Arial";
const W = 13.33, H = 7.5, MX = 0.45;
const CW = W - 2 * MX;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { bodyFontFace: F, headFontFace: F };

let pageNo = 0;

function header(s, num, kicker, title) {
  pageNo += 1;
  s.addShape("roundRect", { x: MX, y: 0.3, w: 0.52, h: 0.52, rectRadius: 0.08,
    fill: { color: DEEP }, line: { type: "none" } });
  s.addText(num, { x: MX, y: 0.3, w: 0.52, h: 0.52, fontFace: F, fontSize: 16,
    bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(kicker.toUpperCase(), { x: MX + 0.68, y: 0.3, w: CW - 0.68, h: 0.24,
    fontFace: F, fontSize: 10, bold: true, color: MIDP, charSpacing: 2.5, margin: 0, isTextBox: true });
  s.addText(title, { x: MX + 0.68, y: 0.53, w: CW - 0.68, h: 0.62, fontFace: F,
    fontSize: 19.5, bold: true, color: INK, margin: 0, isTextBox: true, valign: "top" });
}

function footer(s, source) {
  s.addText(source, { x: MX, y: 7.12, w: 9.6, h: 0.26, fontFace: F, fontSize: 7.5,
    color: FAINT, margin: 0, isTextBox: true });
  s.addText(`ControlPlane · Detailed Business Proposal · ${String(pageNo).padStart(2, "0")}`, {
    x: W - 3.6, y: 7.12, w: 3.6 - MX, h: 0.26, fontFace: F, fontSize: 7.5,
    color: FAINT, align: "right", margin: 0, isTextBox: true });
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06,
    fill: { color: opts.fill || "FFFFFF" },
    line: { color: opts.border || BORDER, width: opts.borderW || 1 } });
}

function label(s, x, y, text, color, w, size) {
  s.addText(text.toUpperCase(), { x, y, w: w || 5, h: 0.22, fontFace: F,
    fontSize: size || 9, bold: true, color: color || MUTED, charSpacing: 2, margin: 0, isTextBox: true });
}

function chip(s, x, y, w, text, fg, bg, size) {
  s.addShape("roundRect", { x, y, w, h: 0.3, rectRadius: 0.15,
    fill: { color: bg }, line: { type: "none" } });
  s.addText(text, { x, y, w, h: 0.3, fontFace: F, fontSize: size || 8.5, bold: true,
    color: fg, align: "center", valign: "middle", margin: 0, isTextBox: true });
}

const fs = require("fs");
function icon(s, name, x, y, size) {
  const p = `icons/${name}.png`;
  if (!fs.existsSync(p)) return;
  s.addImage({ path: p, x, y, w: size || 0.34, h: size || 0.34 });
}

// flat icon on a white rounded tile - for dark or coloured surfaces
function iconBadge(s, name, x, y, size) {
  const d = size || 0.4;
  s.addShape("roundRect", { x, y, w: d, h: d, rectRadius: 0.07,
    fill: { color: "FFFFFF" }, line: { color: BORDER, width: 0.5 } });
  icon(s, name, x + d * 0.14, y + d * 0.14, d * 0.72);
}

function kpi(s, x, y, w, h, big, lbl, color, bg) {
  card(s, x, y, w, h, { fill: bg || TINT2, border: BORDER });
  s.addText(big, { x: x + 0.12, y: y + 0.07, w: w - 0.24, h: h * 0.5, fontFace: F,
    fontSize: 21, bold: true, color: color || DEEP, margin: 0, isTextBox: true });
  s.addText(lbl, { x: x + 0.12, y: y + h * 0.52, w: w - 0.24, h: h * 0.45, fontFace: F,
    fontSize: 8.5, color: MUTED, margin: 0, isTextBox: true, valign: "top" });
}

function numCircle(s, x, y, d, txt, bg, fg) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: bg }, line: { type: "none" } });
  s.addText(txt, { x, y, w: d, h: d, fontFace: F, fontSize: d > 0.4 ? 14 : 11, bold: true,
    color: fg || "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
}

function checkRow(s, x, y, w, text, size) {
  s.addText("✓", { x, y, w: 0.28, h: 0.3, fontFace: F, fontSize: (size || 10) + 1,
    bold: true, color: GREEN, margin: 0, isTextBox: true });
  s.addText(text, { x: x + 0.3, y, w: w - 0.3, h: 0.55, fontFace: F, fontSize: size || 10,
    color: INK, margin: 0, isTextBox: true, valign: "top" });
}

// ============================================================ 1 · TITLE
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  pageNo = 1;
  // left block
  s.addText("ACCENTURE INNOVATION CHALLENGE 2026  ·  ROUND 2  ·  PROBLEM TRACK 1 · CONTROLPLANE.AI", {
    x: MX, y: 0.55, w: 8.1, h: 0.3, fontFace: F, fontSize: 10.5, bold: true,
    color: MIDP, charSpacing: 2.5, margin: 0, isTextBox: true });
  s.addText("ControlPlane", { x: MX, y: 1.0, w: 8.1, h: 1.0, fontFace: F,
    fontSize: 54, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText("Detailed Business Proposal", { x: MX, y: 2.05, w: 8.1, h: 0.5,
    fontFace: F, fontSize: 23, bold: true, color: PURPLE, margin: 0, isTextBox: true });
  s.addText([
    { text: "Govern the ", options: { color: INK } },
    { text: "episode", options: { color: MIDP, bold: true } },
    { text: ", not the response - a rupee-denominated risk budget, claim provenance and an action gate across the whole AI task.", options: { color: INK } },
  ], { x: MX, y: 2.7, w: 7.9, h: 0.75, fontFace: F, fontSize: 14, margin: 0, isTextBox: true });
  // section chips
  const secs = ["Problem", "Solution", "Users", "Business case", "Go-to-market", "Roadmap", "Risks"];
  const chw = 1.06;
  secs.forEach((t, i) => chip(s, MX + i * (chw + 0.08), 3.65, chw, t, DEEP, TINT, 8));
  // deliverables row
  const del = [
    ["This document", "the detailed business proposal the brief requires", DEEP, "FcDocument"],
    ["Working prototype", "public repo · gateway, console, 10-act demo, eval suite", MIDP, "FcSettings"],
    ["Pitch presentation", "proposal + live prototype, replay-first (offline-safe)", PURPLE, "FcBusinessman"],
  ];
  del.forEach((d, i) => {
    const x = MX + i * 2.72;
    card(s, x, 4.15, 2.56, 1.05, { fill: TINT2 });
    icon(s, d[3], x + 0.13, 4.24, 0.36);
    s.addText(d[0], { x: x + 0.56, y: 4.27, w: 1.94, h: 0.28, fontFace: F, fontSize: 11.5,
      bold: true, color: d[2], margin: 0, isTextBox: true });
    s.addText(d[1], { x: x + 0.14, y: 4.58, w: 2.3, h: 0.55, fontFace: F, fontSize: 8.5,
      color: MUTED, margin: 0, isTextBox: true, valign: "top" });
  });
  s.addText([
    { text: "Team Pluoton", options: { bold: true, color: INK, fontSize: 13 } },
    { text: "   ·   August 2026   ·   every figure measured on the prototype and reproduced by ", options: { color: MUTED, fontSize: 10 } },
    { text: "python -m evals.run", options: { color: MIDP, fontSize: 10, bold: true } },
  ], { x: MX, y: 5.4, w: 8.1, h: 0.35, fontFace: F, margin: 0, isTextBox: true });
  s.addText(
    "Round 1 concept selected to advance: a tiered Responsible AI Checker. Round 2 ships it, measures it, and adds the layer no incumbent governs - the episode.",
    { x: MX, y: 5.85, w: 7.9, h: 0.5, fontFace: F, fontSize: 10, italic: true,
      color: MUTED, margin: 0, isTextBox: true, valign: "top" });
  const s1stats = [["3,488", "seeded eval records"], ["26", "tests passing"], ["3 + 3", "policy packs · jurisdictions"],
    ["10 acts", "offline scripted demo"], ["1 cmd", "docker compose up"]];
  s1stats.forEach((t, i) => {
    const x = MX + i * 1.68;
    card(s, x, 6.42, 1.54, 0.8, { fill: TINT2 });
    s.addText(t[0], { x: x + 0.1, y: 6.5, w: 1.36, h: 0.3, fontFace: F, fontSize: 12.5,
      bold: true, color: DEEP, margin: 0, isTextBox: true });
    s.addText(t[1], { x: x + 0.1, y: 6.82, w: 1.36, h: 0.36, fontFace: F, fontSize: 7,
      color: MUTED, margin: 0, isTextBox: true, valign: "top" });
  });
  // right hero panel
  card(s, 8.85, 0.55, W - MX - 8.85, 6.4, { fill: DEEP, border: DEEP });
  s.addText("MEASURED ON THE WORKING PROTOTYPE", { x: 9.1, y: 0.82, w: 3.6, h: 0.25,
    fontFace: F, fontSize: 9, bold: true, color: "D9B8FF", charSpacing: 2, margin: 0, isTextBox: true });
  const heroes = [
    ["41/41", "tainted irreversible actions held before execution - 0/47 false holds"],
    ["96.4-100%", "recall per risk category, with 95% confidence intervals"],
    ["12.6 ms", "median added latency per request · 108 req/s per instance"],
    ["4.8×", "ROI floor from remediation alone - before any regulatory term"],
  ];
  heroes.forEach((t, i) => {
    const y = 1.16 + i * 1.33;
    card(s, 9.1, y, 3.75, 1.2, { fill: "FFFFFF", border: "FFFFFF" });
    s.addText(t[0], { x: 9.28, y: y + 0.08, w: 3.4, h: 0.48, fontFace: F, fontSize: 25,
      bold: true, color: DEEP, margin: 0, isTextBox: true });
    s.addText(t[1], { x: 9.28, y: y + 0.58, w: 3.4, h: 0.56, fontFace: F, fontSize: 9.5,
      color: MUTED, margin: 0, isTextBox: true, valign: "top" });
  });
  s.addText("prototype · console · demo · evals - all in the public repository", {
    x: 9.1, y: 6.55, w: 3.75, h: 0.3, fontFace: F, fontSize: 8.5, italic: true,
    color: "D9B8FF", margin: 0, isTextBox: true });
  s.addNotes("Open on the reposition: response checking is commodity; the episode is ungoverned. Every right-panel number is measured.");
}

// ============================================================ 2 · INDEX
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "i", "Contents", "Index - eight sections plus appendix; 02 to 08 are the brief's required proposal spec, in order");
  const items = [
    ["01", "Introduction", "Round 1 → Round 2 continuity, the mandate, stated assumptions", "3",
      "6 R1 claims reconciled - every one beaten or made precise", "FcDocument"],
    ["02", "Problem framing", "Detection is commodity; compounding episode risk is ungoverned", "4",
      "Exhibit: compounding-risk curve · 4 incident stats", "FcHighPriority"],
    ["03", "Solution design", "Risk budget in ₹ · claim taint · action gate - over a policy-driven gateway", "5",
      "Exhibit: 7-step pipeline · tier ladder · 6 decision outcomes", "FcFlowChart"],
    ["04", "Target users", "CIO + CRO buyer; three governed lanes with measured proof per lane", "6",
      "Exhibit: recall bar chart · 0 false flags · 43/43 abstentions", "FcConferenceCall"],
    ["05", "Business case & impact", "4.8× ROI floor, scenario band shown separately, 0.04% unit economics", "7",
      "Exhibit: ROI chart · assumption stack · 5 unit-economics KPIs", "FcComboChart"],
    ["06", "Go-to-market", "Land-expand-run on Accenture's delivery motion; the competitive map", "8",
      "Exhibit: land-expand-run flow · competitive 2×2 matrix", "FcGlobe"],
    ["07", "Phased roadmap", "Episode layer live from day zero; phases gate enforcement authority", "9",
      "Exhibit: 18-month gantt · 4 contract-grade milestones", "FcCalendar"],
    ["08", "Key risks & mitigations", "Six risks, each countermeasure already shipped - plus stated scope", "10",
      "Exhibit: residual-risk register · 3 verification commands", "FcInspection"],
    ["A", "Appendix", "Every number in this deck, its source file, and how to reproduce it", "11",
      "Full eval table with CIs · repro commands · assumption register", "FcSurvey"],
  ];
  const cw = (CW - 0.5) / 3, chh = 1.62;
  items.forEach((it, i) => {
    const cx = MX + (i % 3) * (cw + 0.25), cy = 1.4 + Math.floor(i / 3) * (chh + 0.22);
    const core = i >= 1 && i <= 7;
    card(s, cx, cy, cw, chh, { fill: core ? TINT2 : "FFFFFF" });
    icon(s, it[5], cx + 0.16, cy + 0.16, 0.44);
    s.addText(it[1], { x: cx + 0.72, y: cy + 0.17, w: cw - 1.45, h: 0.5, fontFace: F,
      fontSize: 12.5, bold: true, color: INK, margin: 0, isTextBox: true });
    s.addText(it[2], { x: cx + 0.2, y: cy + 0.72, w: cw - 0.4, h: 0.56, fontFace: F,
      fontSize: 9.5, color: MUTED, margin: 0, isTextBox: true, valign: "top" });
    s.addShape("rect", { x: cx + 0.2, y: cy + 1.24, w: cw - 0.4, h: 0.011,
      fill: { color: BORDER }, line: { type: "none" } });
    s.addText(it[4], { x: cx + 0.2, y: cy + 1.3, w: cw - 0.4, h: 0.28, fontFace: F,
      fontSize: 7.5, bold: true, color: MIDP, margin: 0, isTextBox: true, valign: "top" });
    chip(s, cx + cw - 0.85, cy + 0.22, 0.65, (it[0] === "A" ? "p. " : it[0] + " · p.") + it[3], core ? MIDP : FAINT, core ? TINT : "F2F2F5", 7.5);
  });
  s.addText([
    { text: "Brief-required core (sections 02-08, tinted): ", options: { bold: true, color: DEEP } },
    { text: "problem framing · solution design · target users · business case and impact · a phased roadmap · key risks with mitigations - exactly the deliverable specification of the Round 2 problem statement.", options: { color: MUTED } },
  ], { x: MX, y: 6.72, w: CW, h: 0.35, fontFace: F, fontSize: 10, margin: 0, isTextBox: true });
  footer(s, "Structure mapped 1:1 onto “What Round 2 Asks You to Deliver”, AIC 2026 Round 2 problem statement.");
}

// ============================================================ 4 · INTRODUCTION
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "01", "Introduction", "We built the prototype first, measured it, and wrote this business case on the results");
  // left: R1 -> R2 table
  const lw = 6.55;
  card(s, MX, 1.4, lw, 3.35);
  icon(s, "FcPositiveDynamic", MX + lw - 0.58, 1.53, 0.38);
  label(s, MX + 0.2, 1.55, "Round 1 promised → Round 2 measured", DEEP, lw - 0.4);
  const rows = [
    [{ text: "Round 1 claim", options: { bold: true } }, { text: "Round 2 evidence", options: { bold: true } }],
    ["Tiered Tier 0-3 checker, inline, real-time", "✓ shipped - deterministic → small models → LLM judge → human"],
    ["< 60 ms added latency (Tier-0 target)", "✓ beaten - 12.6 ms p50 / 20.3 ms p95, full lite ensemble"],
    ["> 90% of injected failures caught", "✓ beaten - 96.4-100% recall per category, with 95% CIs"],
    ["< 3% of model token spend", "✓ beaten - 0.04% of model spend under load"],
    ["“Real-time streaming interception”", "made precise: sentence-buffered release, PII masked pre-wire"],
    ["Bias / responsibility guarantees", "✓ hardened - bias stays annotate-only, structurally enforced + regression-tested"],
  ];
  s.addTable(rows.map((r, i) => r.map(c => typeof c === "string"
      ? { text: c, options: { color: i === 0 ? INK : (c.startsWith("✓") ? GREEN : INK), fontSize: 9 } }
      : { text: c.text, options: { ...c.options, color: DEEP, fontSize: 9 } })), {
    x: MX + 0.2, y: 1.86, w: lw - 0.4, colW: [2.7, 3.45],
    border: { type: "solid", color: BORDER, pt: 0.5 }, fill: { color: "FFFFFF" },
    fontFace: F, valign: "middle", margin: 0.04, autoPage: false,
  });
  s.addText("Prototype scale: 53 tests · 3,488-record eval set · 10-act demo · React operator console · one-command Docker run",
    { x: MX + 0.2, y: 4.42, w: lw - 0.4, h: 0.26, fontFace: F, fontSize: 8, italic: true,
      color: MUTED, margin: 0, isTextBox: true });
  // right: assumptions
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  card(s, rx, 1.4, rw, 3.35, { fill: TINT2 });
  icon(s, "FcRules", rx + rw - 0.58, 1.53, 0.38);
  label(s, rx + 0.2, 1.55, "Stated assumptions - brief parameters, adapted freely", AMBER, rw - 0.4);
  const asm = [
    ["3", "concurrent AI lanes: customer support · internal copilot · regulated decision-support"],
    ["2.1M", "interactions per year (~40,000/week combined) - the brief's own volume"],
    ["MIXED", "well-governed and loosely governed data sources feed the lanes"],
    ["API", "foundation models consumed via API - input/output-layer inspection only"],
  ];
  asm.forEach((a, i) => {
    const y = 1.92 + i * 0.7;
    s.addShape("roundRect", { x: rx + 0.2, y, w: 1.05, h: 0.55, rectRadius: 0.06,
      fill: { color: "FFFFFF" }, line: { color: BORDER, width: 1 } });
    s.addText(a[0], { x: rx + 0.2, y, w: 1.05, h: 0.55, fontFace: F, fontSize: 14,
      bold: true, color: DEEP, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(a[1], { x: rx + 1.42, y: y + 0.02, w: rw - 1.65, h: 0.62, fontFace: F,
      fontSize: 9.5, color: INK, margin: 0, isTextBox: true, valign: "top" });
  });
  // bottom: what changed + how to read
  card(s, MX, 4.95, CW, 0.95, { fill: REDT, border: REDT });
  s.addText([
    { text: "What changed since Round 1:  ", options: { bold: true, color: RED } },
    { text: "inline response checking became commodity - leading platforms ship sub-200 ms guardrails. We kept ours, stopped selling it as the innovation, and moved the differentiator to episode-level governance: a ₹ risk budget, claim provenance and an action gate across the whole task.",
      options: { color: INK } },
  ], { x: MX + 0.2, y: 5.08, w: CW - 0.4, h: 0.72, fontFace: F, fontSize: 10.5, margin: 0, isTextBox: true, valign: "top" });
  label(s, MX, 6.1, "How to read - the seven core sections that follow", MUTED, 6);
  const guide = ["03 Problem", "04 Solution", "05 Users", "06 Business case", "07 GTM", "08 Roadmap", "09 Risks"];
  guide.forEach((g, i) => {
    const gw = (CW - 6 * 0.42) / 7;
    const gx = MX + i * (gw + 0.42);
    chip(s, gx, 6.4, gw, g, DEEP, TINT, 8.5);
    if (i < 6) s.addText("→", { x: gx + gw + 0.04, y: 6.4, w: 0.34, h: 0.3, fontFace: F,
      fontSize: 11, bold: true, color: FAINT, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("Each chip is one slide; every quantitative claim on them is annotated with where it is reproduced - the eval suite, the load test, or a stated assumption (full map in the appendix).",
    { x: MX, y: 6.78, w: CW, h: 0.28, fontFace: F, fontSize: 8.5, italic: true,
      color: MUTED, margin: 0, isTextBox: true });
  footer(s, "Round 1 claims: Team Pluoton R1 deck. Round 2 evidence: evals/out/results.json, evals/out/load_test.json (public repository).");
}

// ============================================================ 5 · CORE 1 - PROBLEM FRAMING
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "02", "Core proposal · problem framing",
    "Per-response guardrails are commodity - the compounding risk of a whole task is ungoverned");
  // left: line chart
  const lw = 7.15;
  card(s, MX, 1.4, lw, 3.9);
  label(s, MX + 0.2, 1.53, "How an episode fails with every response individually “safe”", DEEP, lw - 0.4);
  s.addText("Cumulative expected loss across one demo episode (₹ thousand)", {
    x: MX + 0.2, y: 1.77, w: lw - 0.4, h: 0.22, fontFace: F, fontSize: 8.5, color: MUTED,
    margin: 0, isTextBox: true });
  s.addChart("line", [
    { name: "Cumulative episode risk", labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
      values: [12, 26, 41, 55, 68, 84, 103.5] },
    { name: "Episode budget (₹100k)", labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
      values: [100, 100, 100, 100, 100, 100, 100] },
  ], {
    x: MX + 0.15, y: 2.0, w: lw - 0.35, h: 2.6,
    chartColors: [MIDP, RED],
    lineSize: 2.5, lineSmooth: false,
    lineDataSymbol: "circle", lineDataSymbolSize: 5,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 9, catAxisLineColor: BORDER,
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 9, valAxisLineColor: BORDER,
    valGridLine: { color: "EFECF5", size: 0.5 }, catGridLine: { style: "none" },
    valAxisMinVal: 0, valAxisMaxVal: 120,
    showLegend: true, legendPos: "b", legendColor: MUTED, legendFontSize: 9,
    showTitle: false, chartArea: { fill: { color: "FFFFFF" } },
  });
  s.addText([
    { text: "Turn 7: HOLD - ₹103,467 vs ₹100,000 budget (measured, demo act 6). ", options: { bold: true, color: RED } },
    { text: "No single turn ever crossed a per-response block threshold. Intermediate points illustrative; endpoints measured.", options: { color: MUTED } },
  ], { x: MX + 0.2, y: 4.72, w: lw - 0.4, h: 0.5, fontFace: F, fontSize: 9, margin: 0, isTextBox: true, valign: "top" });
  // right: incident tiles
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  label(s, rx, 1.42, "2026: agents are failing in exactly this shape", RED, rw);
  const tiles = [
    ["10 / 11", "open-source coding & computer-use agents bypassed raw-string shell guards (GuardFall)"],
    ["1 email", "was enough to poison agent memory - one planted “fact” steered later actions (MemGhost)"],
    ["~20%", "of organisations report mature AI governance (Deloitte, 2026)"],
    ["Art. 14", "EU AI Act demands effective human oversight - for agents, only dischargeable at episode level"],
  ];
  const tileIcons = ["FcCancel", "FcHighPriority", "FcSurvey", "FcRules"];
  tiles.forEach((t, i) => {
    const y = 1.7 + i * 0.93;
    kpi(s, rx, y, rw, 0.87, t[0], t[1], DEEP);
    icon(s, tileIcons[i], rx + rw - 0.52, y + 0.12, 0.38);
  });
  // bottom band: commodity + quote
  card(s, MX, 5.42, 7.15, 1.55, { fill: TINT2 });
  label(s, MX + 0.2, 5.55, "Already solved by the market - we don't resell it", MUTED, 6.7);
  const solved = ["<200 ms in-VPC response checks", "EU AI Act / NIST RMF / ISO 42001 policy mapping", "Hyperscaler guardrails bundled ~free"];
  solved.forEach((t, i) => checkRow(s, MX + 0.2, 5.85 + i * 0.36, 6.8, t, 9.5));
  card(s, MX + 7.45, 5.42, CW - 7.45, 1.55, { fill: DEEP, border: DEEP });
  s.addText(
    "“Multi-turn conversations and AI agents that take actions introduce compounding risk, where one questionable output can shape several downstream decisions.”",
    { x: MX + 7.65, y: 5.56, w: CW - 7.85, h: 1.0, fontFace: F, fontSize: 10.5, italic: true,
      color: "FFFFFF", margin: 0, isTextBox: true, valign: "top" });
  s.addText("- Round 2 brief, Problem Track 1: the gap, named by the examiner", {
    x: MX + 7.65, y: 6.6, w: CW - 7.85, h: 0.3, fontFace: F, fontSize: 8.5,
    color: "D9B8FF", margin: 0, isTextBox: true });
  footer(s, "Sources: GuardFall / MemGhost / Friendly Fire (2026 agent-security research); Deloitte AI governance survey 2026; EU AI Act Art. 14; demo act 6 (measured endpoint).");
}

// ============================================================ 6 · CORE 2 - SOLUTION DESIGN
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "03", "Core proposal · solution design",
    "Three mechanisms govern the episode - on a gateway where policy is data, not code");
  // pipeline flow
  const steps = ["Ingress gate", "Stream + mask", "Detect (T0-T3)", "Calibrated fusion", "Episode debit", "Decision", "Evidence ledger"];
  const sw = (CW - 6 * 0.14) / 7;
  steps.forEach((t, i) => {
    const x = MX + i * (sw + 0.14);
    s.addShape("chevron", { x, y: 1.42, w: sw + 0.12, h: 0.52,
      fill: { color: i === 4 ? PURPLE : (i === 6 ? DEEP : TINT) }, line: { type: "none" } });
    s.addText(t, { x: x + 0.08, y: 1.42, w: sw - 0.04, h: 0.52, fontFace: F, fontSize: 8.5,
      bold: true, color: (i === 4 || i === 6) ? "FFFFFF" : DEEP, align: "center",
      valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("OpenAI-compatible proxy · per-use-case latency budgets · PII masked before it reaches the wire · every decision hash-chained and HMAC-signed",
    { x: MX, y: 1.98, w: CW, h: 0.2, fontFace: F, fontSize: 8, italic: true, color: MUTED,
      align: "center", margin: 0, isTextBox: true });
  const tiers = [
    ["TIER 0 · deterministic - regex, checksum, taint · ~0 ms", DEEP, TINT],
    ["TIER 1 · lexical & small models - in budget", MIDP, TINT],
    ["TIER 2 · LLM judge - >96% need no LLM call", "FFFFFF", MIDP],
    ["TIER 3 · human - override queue, 2-person rule", "FFFFFF", DEEP],
  ];
  tiers.forEach((t, i) => {
    const tw = (CW - 3 * 0.14) / 4;
    chip(s, MX + i * (tw + 0.14), 2.22, tw, t[0], t[1], t[2], 7.5);
  });
  // three mechanism cards
  const mech = [
    ["1", "Episode risk budget - in rupees", MIDP,
      "Every passed-but-uncertain output debits a hazard-based expected-loss meter, priced from a severity table the client's risk office signs. The EPISODE escalates when cumulative risk crosses budget.",
      "demo: HOLD at turn 7 - ₹103,467 vs ₹100,000"],
    ["2", "Claim provenance & taint", BLUE,
      "Numbers, dates, names, IDs are canonicalised - “eighty-five thousand” = 85000 = ₹85,000. A value born ungrounded in model output stays tainted across every later turn. Deterministic, milliseconds, no model call.",
      "words → digits cannot launder a fabrication"],
    ["3", "Action gate on reversibility", GREEN,
      "An irreversible tool call - pay, send, delete, submit - needs a taint-clear episode, not just clean arguments. Held BEFORE execution, evidence chain attached, two-person override.",
      "measured: 41/41 tainted held · 0/47 false holds"],
  ];
  const mw = (CW - 0.5) / 3;
  const mechIcons = ["FcMoneyTransfer", "FcSearch", "FcLock"];
  mech.forEach((m, i) => {
    const x = MX + i * (mw + 0.25);
    card(s, x, 2.68, mw, 2.68, { fill: TINT2 });
    icon(s, mechIcons[i], x + mw - 0.6, 2.82, 0.42);
    numCircle(s, x + 0.18, 2.84, 0.44, m[0], m[2]);
    s.addText(m[1], { x: x + 0.74, y: 2.84, w: mw - 0.9, h: 0.55, fontFace: F, fontSize: 12.5,
      bold: true, color: INK, margin: 0, isTextBox: true, valign: "top" });
    s.addText(m[3], { x: x + 0.2, y: 3.46, w: mw - 0.4, h: 1.4, fontFace: F, fontSize: 9.5,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
    s.addShape("roundRect", { x: x + 0.2, y: 4.9, w: mw - 0.4, h: 0.36, rectRadius: 0.06,
      fill: { color: "FFFFFF" }, line: { color: BORDER, width: 0.75 } });
    s.addText(m[4], { x: x + 0.2, y: 4.9, w: mw - 0.4, h: 0.36, fontFace: F, fontSize: 8.5,
      bold: true, color: m[2], align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  // decision set + policy row
  card(s, MX, 5.55, 7.15, 1.4);
  label(s, MX + 0.2, 5.68, "One calibrated decision per response - six outcomes", DEEP, 6.7);
  const dec = [["PASS", GREEN, GREENT], ["ANNOTATE", BLUE, BLUET], ["REPAIR", MIDP, TINT],
    ["ESCALATE", AMBER, AMBERT], ["BLOCK", RED, REDT], ["HOLD ACTION", "FFFFFF", DEEP]];
  dec.forEach((d, i) => {
    const dw = (7.15 - 0.4 - 5 * 0.12) / 6;
    chip(s, MX + 0.2 + i * (dw + 0.12), 6.0, dw, d[0], d[1], d[2], 8);
  });
  s.addText("REPAIR is deterministic (mask / correct / cite-strip) - the “edit” tier that latency pressure never cuts.",
    { x: MX + 0.2, y: 6.42, w: 6.7, h: 0.4, fontFace: F, fontSize: 8.5, italic: true,
      color: MUTED, margin: 0, isTextBox: true });
  card(s, MX + 7.45, 5.55, CW - 7.45, 1.4, { fill: TINT2 });
  label(s, MX + 7.65, 5.68, "Governance as configuration", MIDP, CW - 7.9);
  s.addText(
    "Three signed policy packs + IN / EU / US jurisdiction overlays, hot-reloaded with anti-rollback. Detection stays pluggable commodity - bring any vendor; the episode layer above it is the product.",
    { x: MX + 7.65, y: 5.9, w: CW - 7.95, h: 0.62, fontFace: F, fontSize: 9,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
  const packChips = [["customer_support · fail-open", GREEN, GREENT],
    ["internal_copilot · 1.5 s", BLUE, BLUET], ["decision_support · fail-closed", RED, REDT]];
  packChips.forEach((p, i) => {
    const pcw = (CW - 7.45 - 0.4 - 0.2) / 3;
    chip(s, MX + 7.65 + i * (pcw + 0.1), 6.55, pcw, p[0], p[1], p[2], 7);
  });
  footer(s, "Mechanisms and pipeline as shipped in the prototype (controlplane/); gate and taint figures: evals/out/results.json.");
}

// ============================================================ 7 · CORE 3 - TARGET USERS
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "04", "Core proposal · target users",
    "One platform, three governed lanes - each lane a policy pack with its own physics");
  // buyer band
  card(s, MX, 1.4, CW, 0.72, { fill: TINT2 });
  s.addText([
    { text: "Economic buyer: ", options: { bold: true, color: DEEP } },
    { text: "CIO / Head of AI Platform, with the CRO as co-sponsor whose regulatory pressure creates urgency. Engineering, FinOps and operations are stakeholders to neutralise - latency, cost, alert fatigue - not signatures to collect. Daily users: risk-ops analysts on the console + the L1/L2 triage bench.",
      options: { color: INK } },
  ], { x: MX + 0.2, y: 1.5, w: CW - 0.4, h: 0.55, fontFace: F, fontSize: 10, margin: 0, isTextBox: true, valign: "top" });
  // three lanes
  const lanes = [
    ["Customer support assistant", "customer-facing · real-time", GREEN, GREENT,
      ["150 ms detector budget", "fail-open on checker fault", "PII masked mid-stream", "REPAIR over BLOCK - protect CX"],
      "privacy 100% · 0 false flags"],
    ["Internal knowledge copilot", "employee-facing · near-real-time", BLUE, BLUET,
      ["1.5 s budget - fuller ensemble", "source-trust tiers debit differently", "annotate-first posture", "abstains instead of inventing"],
      "grounding 96.4% · abstention 43/43"],
    ["Decision-support tool", "regulated · action-taking", RED, REDT,
      ["gate mode · fail-closed", "actions held on episode taint", "two-person override", "IN/EU/US packs flip outcomes live"],
      "41/41 held · 0/47 false holds"],
  ];
  const lw2 = (CW - 0.5) / 3;
  const laneIcons = ["FcSupport", "FcOrganization", "FcDataProtection"];
  lanes.forEach((l, i) => {
    const x = MX + i * (lw2 + 0.25);
    card(s, x, 2.3, lw2, 2.6);
    icon(s, laneIcons[i], x + lw2 - 0.58, 2.44, 0.4);
    s.addShape("roundRect", { x: x + 0.16, y: 2.46, w: 0.09, h: 0.6, rectRadius: 0.04,
      fill: { color: l[2] }, line: { type: "none" } });
    s.addText(l[0], { x: x + 0.38, y: 2.44, w: lw2 - 0.55, h: 0.35, fontFace: F, fontSize: 11.5,
      bold: true, color: INK, margin: 0, isTextBox: true });
    s.addText(l[1], { x: x + 0.38, y: 2.78, w: lw2 - 0.55, h: 0.26, fontFace: F, fontSize: 8.5,
      bold: true, color: MUTED, margin: 0, isTextBox: true });
    l[4].forEach((b, j) => checkRow(s, x + 0.2, 3.14 + j * 0.34, lw2 - 0.4, b, 9));
    chip(s, x + 0.2, 4.52, lw2 - 0.4, l[5], l[2] === RED ? RED : (l[2] === BLUE ? BLUE : GREEN), l[3], 8.5);
  });
  // bottom: chart + kpis
  const chw2 = 7.15;
  card(s, MX, 5.1, chw2, 1.85);
  label(s, MX + 0.2, 5.2, "Measured recall by risk category - % of injected failures caught", DEEP, chw2 - 0.4);
  s.addChart("bar", [
    { name: "Recall", labels: ["Cost", "Injection", "Toxicity", "Privacy", "Grounding"],
      values: [100, 100, 100, 100, 96.4] },
  ], {
    x: MX + 0.15, y: 5.45, w: chw2 - 0.35, h: 1.42,
    barDir: "bar", chartColors: [MIDP], barGapWidthPct: 60,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 8.5, catAxisLineColor: BORDER,
    valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 112,
    valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: DEEP,
    dataLabelFontSize: 9, dataLabelFormatCode: "0.#\"%\"",
    showLegend: false, showTitle: false, chartArea: { fill: { color: "FFFFFF" } },
  });
  kpi(s, MX + chw2 + 0.3, 5.1, (CW - chw2 - 0.6) / 2, 1.85, "0",
    "false flags across 2,381 benign test records - over-flagging is the adoption killer; we measured against it", GREEN, GREENT);
  kpi(s, MX + chw2 + 0.45 + (CW - chw2 - 0.6) / 2, 5.1, (CW - chw2 - 0.6) / 2, 1.85, "43/43",
    "correct abstentions - INSUFFICIENT_EVIDENCE instead of an invented answer, per the brief's “no ground truth” complexity", BLUE, BLUET);
  footer(s, "Recall, false-flag, abstention and gate figures: evals/out/results.json (test split, 2,381 records; 95% CIs in repository README).");
}

// ============================================================ 8 · CORE 4 - BUSINESS CASE
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "05", "Core proposal · business case & impact",
    "₹1.2 Cr avoided loss against ₹25L all-in cost - a 4.8× floor before any regulatory term");
  // left: chart + hero
  const lw = 4.6;
  card(s, MX, 1.4, lw, 3.5);
  icon(s, "FcComboChart", MX + lw - 0.58, 1.52, 0.38);
  label(s, MX + 0.2, 1.53, "Floor case, per client per year (₹ Cr)", DEEP, lw - 0.4);
  s.addChart("bar", [
    { name: "₹ Cr / yr", labels: ["Avoided loss (floor)", "All-in assurance cost"], values: [1.2, 0.25] },
  ], {
    x: MX + 0.15, y: 1.82, w: lw - 0.35, h: 2.2,
    barDir: "col", chartColors: [MIDP], barGapWidthPct: 80,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 9, catAxisLineColor: BORDER,
    valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 1.4,
    valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: DEEP,
    dataLabelFontSize: 11, dataLabelFormatCode: "₹0.0#\" Cr\"",
    showLegend: false, showTitle: false, chartArea: { fill: { color: "FFFFFF" } },
  });
  s.addShape("roundRect", { x: MX + 0.2, y: 4.18, w: lw - 0.4, h: 0.56, rectRadius: 0.08,
    fill: { color: DEEP }, line: { type: "none" } });
  s.addText([
    { text: "ROI floor ≈ 4.8×", options: { bold: true, color: "FFFFFF", fontSize: 14 } },
    { text: "  remediation only, zero regulatory term", options: { color: "D9B8FF", fontSize: 8.5 } },
  ], { x: MX + 0.2, y: 4.18, w: lw - 0.4, h: 0.56, fontFace: F, align: "center",
    valign: "middle", margin: 0, isTextBox: true });
  // middle: assumptions
  const mxx = MX + lw + 0.25, mw = 4.1;
  card(s, mxx, 1.4, mw, 3.5, { fill: TINT2 });
  icon(s, "FcRules", mxx + mw - 0.56, 1.52, 0.36);
  label(s, mxx + 0.2, 1.53, "Every input on the slide", AMBER, mw - 0.4);
  const asm = [
    ["Volume", "2.1M interactions/yr (brief parameter)"],
    ["Material-failure rate", "1.0% - assumed, then measured in shadow"],
    ["Catch rate", "95% - measured on the benchmark"],
    ["Cost per failure", "₹600 remediation + concession"],
    ["All-in cost side", "3 × ₹5L platform + ₹10L managed service, incl. triage bench (8,400 esc/yr × 10 min × ₹500/hr ≈ ₹7L)"],
  ];
  asm.forEach((a, i) => {
    const y = 1.86 + i * 0.5;
    s.addText(a[0], { x: mxx + 0.2, y, w: 1.55, h: 0.46, fontFace: F, fontSize: 8.5,
      bold: true, color: DEEP, margin: 0, isTextBox: true, valign: "top" });
    s.addText(a[1], { x: mxx + 1.8, y, w: mw - 2.0, h: i === 4 ? 0.62 : 0.46, fontFace: F, fontSize: 8.5,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
  });
  s.addText("Scenario band - separate, never blended: probability-weighted DPDP / disclosure / goodwill exposure adds ₹30L-₹1.5Cr. We never anchor on statutory ceilings.",
    { x: mxx + 0.2, y: 4.42, w: mw - 0.4, h: 0.44, fontFace: F, fontSize: 7.5, italic: true,
      color: MUTED, margin: 0, isTextBox: true, valign: "top" });
  // right: CFO checklist
  const rx = mxx + mw + 0.25, rw = W - MX - rx;
  card(s, rx, 1.4, rw, 3.5);
  icon(s, "FcApproval", rx + rw - 0.56, 1.52, 0.36);
  label(s, rx + 0.2, 1.53, "Why this survives a CFO", GREEN, rw - 0.4);
  const cfo = [
    "Attack the assumption, not the method - all inputs visible",
    "Failure rate isn't ours to claim: shadow mode measures it on the client's traffic",
    "Severity table isn't ours to invent: the client's risk office signs it",
    "Triage labour sits inside the denominator - ROI is net of humans",
    "The budget meter IS the ROI dashboard - same ₹ machinery, live",
    "Volume is the brief's own parameter - no invented market size",
  ];
  cfo.forEach((c, i) => checkRow(s, rx + 0.2, 1.88 + i * 0.51, rw - 0.4, c, 9));
  // bottom: unit economics strip
  label(s, MX, 5.12, "Unit economics - why the margin story holds at scale", MUTED, 7);
  const ue = [
    ["0.04%", "assurance compute vs model spend (load test)", GREEN],
    [">96%", "of traffic checked with no LLM call at all", DEEP],
    ["12.6 ms", "p50 added latency · 20.3 ms p95", BLUE],
    ["108 req/s", "per stateless instance at saturation · 0 errors", MIDP],
    ["0.065", "expected calibration error - scores you can price risk on", AMBER],
  ];
  const uw = (CW - 4 * 0.22) / 5;
  const ueIcons = ["FcCurrencyExchange", "FcParallelTasks", "FcAlarmClock", "FcDeployment", "FcBarChart"];
  ue.forEach((u, i) => {
    const x = MX + i * (uw + 0.22);
    kpi(s, x, 5.42, uw, 1.5, u[0], u[1], u[2]);
    icon(s, ueIcons[i], x + uw - 0.5, 5.52, 0.36);
  });
  footer(s, "ROI inputs as stated; measured figures: evals/out/load_test.json, evals/out/results.json. Pricing: per governed use case/month (see 07).");
}

// ============================================================ 9 · CORE 5 - GTM & COMPETITION
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "06", "Core proposal · go-to-market",
    "Land with an audit, price the governed use case, run the service - on Accenture's own motion");
  // top: 3 phases as chevrons
  const ph = [
    ["LAND - Assurance Assessment", "4-6 weeks · fixed fee · AUDIT mode over exported logs - zero production footprint, no InfoSec review blocking week 1. Deliverables: episode risk report + client-signed severity table.", TINT, DEEP],
    ["EXPAND - In-tenancy deployment", "priced per governed use case / agent class per month, tiered by risk class & jurisdictions. 0.04% COGS is the margin story, never the price anchor.", MIDP, "FFFFFF"],
    ["RUN - Managed assurance", "L1/L2/L3 triage bench · quarterly policy-pack updates · drift recalibration vs a frozen canary set. Human review IS the recurring line - priced in.", DEEP, "FFFFFF"],
  ];
  const pw = (CW - 0.3) / 3;
  const phIcons = ["FcShipped", "FcDeployment", "FcServices"];
  ph.forEach((p, i) => {
    const x = MX + i * (pw + 0.15) - (i ? 0.12 : 0);
    s.addShape("chevron", { x, y: 1.4, w: pw + 0.12, h: 1.55,
      fill: { color: p[2] }, line: { type: "none" } });
    if (i === 0) icon(s, phIcons[i], x + pw - 0.62, 1.52, 0.42);
    else iconBadge(s, phIcons[i], x + pw - 0.66, 1.5, 0.46);
    const tx = x + (i ? 0.95 : 0.35);
    s.addText(p[0], { x: x + (i ? 0.68 : 0.35), y: 1.52, w: pw - (i ? 1.0 : 0.55), h: 0.3,
      fontFace: F, fontSize: 10.5,
      bold: true, color: p[3] === "FFFFFF" ? "FFFFFF" : DEEP, margin: 0, isTextBox: true });
    s.addText(p[1], { x: tx, y: 1.84, w: pw - (i ? 1.75 : 1.2), h: 1.05, fontFace: F, fontSize: 8.5,
      color: p[3] === "FFFFFF" ? "FFFFFF" : INK, margin: 0, isTextBox: true, valign: "top" });
  });
  // bottom-left: competitive matrix
  const mwd = 7.15;
  card(s, MX, 3.2, mwd, 3.75);
  label(s, MX + 0.2, 3.32, "Competitive map - the top-right quadrant is empty", DEEP, mwd - 0.4);
  const px = MX + 0.75, py = 3.75, pw2 = mwd - 1.3, ph2 = 2.6;
  s.addShape("rect", { x: px, y: py, w: pw2, h: ph2, fill: { color: TINT2 }, line: { color: BORDER, width: 1 } });
  s.addShape("rect", { x: px + pw2 / 2, y: py, w: 0.012, h: ph2, fill: { color: BORDER }, line: { type: "none" } });
  s.addShape("rect", { x: px, y: py + ph2 / 2, w: pw2, h: 0.012, fill: { color: BORDER }, line: { type: "none" } });
  s.addText("UNIT OF GOVERNANCE →", { x: px, y: py + ph2 + 0.06, w: pw2, h: 0.22, fontFace: F,
    fontSize: 8, bold: true, color: MUTED, align: "center", charSpacing: 1.5, margin: 0, isTextBox: true });
  s.addText("response", { x: px + 0.06, y: py + ph2 + 0.06, w: 1.2, h: 0.22, fontFace: F, fontSize: 8,
    color: FAINT, margin: 0, isTextBox: true });
  s.addText("episode", { x: px + pw2 - 1.26, y: py + ph2 + 0.06, w: 1.2, h: 0.22, fontFace: F, fontSize: 8,
    color: FAINT, align: "right", margin: 0, isTextBox: true });
  s.addText("AUTHORITY →", { x: px - 0.62, y: py + ph2 / 2 - 0.9, w: 1.8, h: 0.22, fontFace: F,
    fontSize: 8, bold: true, color: MUTED, align: "center", charSpacing: 1.5, margin: 0,
    rotate: 270, isTextBox: true });
  s.addText("observe", { x: px + 0.06, y: py + ph2 - 0.28, w: 1.0, h: 0.2, fontFace: F, fontSize: 8,
    color: FAINT, margin: 0, isTextBox: true });
  s.addText("enforce", { x: px + 0.06, y: py + 0.08, w: 1.0, h: 0.2, fontFace: F, fontSize: 8,
    color: FAINT, margin: 0, isTextBox: true });
  const dots = [
    ["Fiddler · Galileo · Arthur", 0.30, 0.72, BLUE],
    ["Hyperscaler guardrails", 0.22, 0.30, AMBER],
    ["AI gateways", 0.12, 0.85, MUTED],
    ["Session observability add-ons", 0.60, 0.80, MIDP],
  ];
  dots.forEach(d => {
    const dx = px + d[1] * pw2, dy = py + d[2] * ph2;
    s.addShape("ellipse", { x: dx - 0.07, y: dy - 0.07, w: 0.14, h: 0.14,
      fill: { color: d[3] }, line: { color: "FFFFFF", width: 1 } });
    s.addText(d[0], { x: dx + 0.1, y: dy - 0.12, w: 2.2, h: 0.24, fontFace: F, fontSize: 8,
      bold: true, color: INK, margin: 0, isTextBox: true });
  });
  const cpx = px + 0.86 * pw2, cpy = py + 0.18 * ph2;
  s.addShape("ellipse", { x: cpx - 0.17, y: cpy - 0.17, w: 0.34, h: 0.34,
    fill: { color: PURPLE }, line: { color: "FFFFFF", width: 1.5 } });
  s.addText("CP", { x: cpx - 0.17, y: cpy - 0.17, w: 0.34, h: 0.34, fontFace: F, fontSize: 9,
    bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("ControlPlane - enforces before the irreversible call, at episode scope", {
    x: cpx - 3.75, y: cpy - 0.55, w: 3.45, h: 0.4, fontFace: F, fontSize: 8, bold: true,
    color: MIDP, align: "right", margin: 0, isTextBox: true });
  s.addText("Competitor placement from public positioning (2026). CP placement is this prototype's measured behaviour: 41/41 pre-execution holds at episode scope.", {
    x: MX + 0.2, y: 6.6, w: mwd - 0.4, h: 0.3, fontFace: F, fontSize: 8, italic: true,
    color: MUTED, margin: 0, isTextBox: true });
  // bottom-right: moat + accenture
  const rx = MX + mwd + 0.3, rw = W - MX - rx;
  card(s, rx, 3.2, rw, 1.8, { fill: TINT2 });
  icon(s, "FcLock", rx + rw - 0.58, 3.32, 0.38);
  label(s, rx + 0.2, 3.33, "The moat is the unit of account", MIDP, rw - 0.4);
  s.addText(
    "Bring-your-own-detector is a feature: commoditised detection makes the neutral episode & evidence layer above it MORE valuable. A fast-follow by incumbents requires abandoning per-response pricing and architecture - their revenue model is the switching cost.",
    { x: rx + 0.2, y: 3.6, w: rw - 0.4, h: 0.95, fontFace: F, fontSize: 9.5, color: INK,
      margin: 0, isTextBox: true, valign: "top" });
  const moatChips = ["unit of account", "signed severity method", "delivery install base"];
  moatChips.forEach((t, i) => {
    const tw = (rw - 0.4 - 2 * 0.12) / 3;
    chip(s, rx + 0.2 + i * (tw + 0.12), 4.58, tw, t, DEEP, "FFFFFF", 7.5);
  });
  card(s, rx, 5.15, rw, 1.8, { fill: DEEP, border: DEEP });
  iconBadge(s, "FcOrganization", rx + rw - 0.62, 5.28, 0.42);
  label(s, rx + 0.2, 5.28, "Why Accenture wins with this", "D9B8FF", rw - 0.4);
  s.addText(
    "It productises what the Responsible AI practice already does manually. Thousands of GenAI delivery engagements are the install base; the assessment, the signed severity methodology and the managed bench are services only a delivery firm can sell at scale.",
    { x: rx + 0.2, y: 5.55, w: rw - 0.4, h: 1.0, fontFace: F, fontSize: 9.5, color: "FFFFFF",
      margin: 0, isTextBox: true, valign: "top" });
  s.addText("Worked example at the brief's volume: ≈ ₹25L/yr per client vs ₹1.2Cr+ modelled avoided loss (section 06).", {
    x: rx + 0.2, y: 6.58, w: rw - 0.4, h: 0.3, fontFace: F, fontSize: 8, italic: true,
    color: "D9B8FF", margin: 0, isTextBox: true });
  footer(s, "Worked example at brief volume: ≈ ₹25L/yr per client (3 use cases + managed service) vs ₹1.2Cr+ modelled avoided loss (06). Competitor placements: public positioning, 2026.");
}

// ============================================================ 10 · CORE 6 - ROADMAP
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "07", "Core proposal · phased roadmap",
    "The episode layer runs from day zero - phases only expand its authority to act");
  // gantt
  const gx = MX + 2.6, gw = CW - 2.6, gy = 1.75, rowH = 0.78, months = 18;
  const scale = gw / months;
  card(s, MX, 1.4, CW, 3.85);
  // month gridline labels
  [0, 3, 6, 9, 12, 15, 18].forEach(m => {
    const x = gx + m * scale;
    s.addShape("rect", { x, y: gy, w: 0.008, h: rowH * 4 + 0.3, fill: { color: "EFECF5" }, line: { type: "none" } });
    s.addText(m === 0 ? "wk 0" : `mo ${m}`, { x: x - 0.3, y: gy + rowH * 4 + 0.32, w: 0.6, h: 0.2,
      fontFace: F, fontSize: 7.5, color: FAINT, align: "center", margin: 0, isTextBox: true });
  });
  const bars = [
    ["PHASE 0 · OBSERVE", 0, 1.5, GREEN, "audit on exported logs → shadow · full episode ledger, zero enforcement"],
    ["PHASE 1 · ENFORCE RESPONSES", 1.5, 3.5, BLUE, "one lane live at a conservative operating point · overrides feed retune"],
    ["PHASE 2 · ENFORCE EPISODES & ACTIONS", 4, 8, MIDP, "budgets + action gate get hold/block authority on the regulated lane"],
    ["PHASE 3 · ESTATE", 8, 18, DEEP, "all lanes · jurisdiction packs · detector-adapter marketplace · cross-estate identity"],
  ];
  const barIcons = ["FcSearch", "FcOk", "FcLock", "FcGlobe"];
  bars.forEach((b, i) => {
    const y = gy + i * rowH;
    icon(s, barIcons[i], MX + 0.13, y + 0.02, 0.3);
    s.addText(b[0], { x: MX + 0.5, y: y + 0.05, w: 2.05, h: 0.6, fontFace: F, fontSize: 8.5,
      bold: true, color: b[3], margin: 0, isTextBox: true, valign: "top" });
    s.addShape("roundRect", { x: gx + b[1] * scale, y: y + 0.05, w: (b[2] - b[1]) * scale, h: 0.34,
      rectRadius: 0.08, fill: { color: b[3] }, line: { type: "none" } });
    s.addText(b[4], { x: gx + b[1] * scale + 0.08, y: y + 0.42, w: Math.max((b[2] - b[1]) * scale + 3.2, 4), h: 0.3,
      fontFace: F, fontSize: 8, color: MUTED, margin: 0, isTextBox: true });
  });
  // milestones
  const mil = [
    [1.4, "severity table signed", 0],
    [3.5, "first enforcement live", 1],
    [8, "gate authority granted", 2],
    [18, "estate-wide governance", 3],
  ];
  mil.forEach(m => {
    const x = gx + m[0] * scale, y = gy + m[2] * rowH + 0.05;
    s.addShape("diamond", { x: x - 0.07, y: y + 0.1, w: 0.14, h: 0.14,
      fill: { color: AMBER }, line: { color: "FFFFFF", width: 1 } });
  });
  s.addText("◆ = contract-grade milestone: severity table signed (wk 6) · first enforcement (wk 14) · gate authority (mo 8) · estate-wide (mo 18)", {
    x: gx, y: gy + rowH * 4 + 0.02, w: gw, h: 0.24, fontFace: F, fontSize: 8, italic: true,
    color: AMBER, margin: 0, isTextBox: true });
  const cbx = gx + 5.45, cbw = gw - 5.6;
  card(s, cbx, gy - 0.02, cbw, 1.16, { fill: TINT2, border: MIDP });
  label(s, cbx + 0.15, gy + 0.08, "Live from week 0 - in shadow", MIDP, cbw - 0.3, 8);
  s.addText(
    "Full episode ledger · ₹ budget calibration on benign traffic · FP/FN baseline · the episode risk report. Capability never waits for authority - only enforcement does.",
    { x: cbx + 0.15, y: gy + 0.32, w: cbw - 0.3, h: 0.76, fontFace: F, fontSize: 8.5,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
  // bottom: exit criteria + why
  const bw = (CW - 0.25) / 2;
  card(s, MX, 5.45, bw, 1.5, { fill: TINT2 });
  icon(s, "FcTodoList", MX + bw - 0.58, 5.56, 0.38);
  label(s, MX + 0.2, 5.58, "Authority follows evidence - the exit criteria", DEEP, bw - 0.4);
  const exits = [
    "Phase 0 → 1: measured FP/FN baseline accepted by operations",
    "Phase 1 → 2: overturn rate below the agreed threshold on live traffic",
    "Phase 2 → 3: gate holds sustained with zero unjustified action blocks",
  ];
  exits.forEach((e, i) => checkRow(s, MX + 0.2, 5.86 + i * 0.34, bw - 0.4, e, 9));
  card(s, MX + bw + 0.25, 5.45, bw, 1.5);
  icon(s, "FcIdea", MX + 2 * bw + 0.25 - 0.58, 5.56, 0.38);
  label(s, MX + bw + 0.45, 5.58, "Why this sequencing wins deals", GREEN, bw - 0.4);
  s.addText(
    "The differentiator is never deferred: the client sees their own episode risk in week 2, in ₹, against a severity table their risk office signed. Enforcement then follows measured trust - exactly how the brief says the over-/under-flagging trade-off must be handled.",
    { x: MX + bw + 0.45, y: 5.86, w: bw - 0.65, h: 1.0, fontFace: F, fontSize: 9.5,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
  footer(s, "Phase durations from the land-motion design (07); shadow-first sequencing per the brief's over-/under-flagging complexity.");
}

// ============================================================ 11 · CORE 7 - RISKS
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "08", "Core proposal · key risks & mitigations",
    "Six risks, six shipped countermeasures - plus scope stated before you ask");
  const lw = 8.35;
  const risks = [
    ["False-positive fatigue → users bypass the checker", "M", AMBER, AMBERT,
      "Shadow-first · operating point is the client's dial on a measured sweep · 0 false flags / 0/47 false holds measured · overturn-rate watch"],
    ["Latency regression breaks customer experience", "L", GREEN, GREENT,
      "Per-detector timeouts under each pack's budget · degraded coverage debits MORE risk · 12.6 ms p50 measured · stateless scale-out"],
    ["The checker itself fails or is attacked", "M", AMBER, AMBERT,
      "Fail-open (chat) / fail-closed (regulated) per pack · Tier 0 never sheds · ingress gate blocks poisoned documents · GuardFall-informed red-teaming"],
    ["Detector drift / model or vendor change", "M", AMBER, AMBERT,
      "Weekly recalibration vs a frozen canary set · model fingerprint on every decision · pluggable adapters - swap vendors, keep governance"],
    ["Evidence ledger becomes a privacy liability", "L", GREEN, GREENT,
      "Keyed-HMAC digests, no raw text at rest · quarantined feedback store · retention policy per jurisdiction pack"],
    ["Incumbents fast-follow the episode concept", "M", AMBER, AMBERT,
      "Moat = unit of account + signed severity methodology + Accenture install base - following requires abandoning per-response pricing"],
  ];
  risks.forEach((r, i) => {
    const y = 1.4 + i * 0.93;
    card(s, MX, y, lw, 0.84, { fill: i % 2 ? TINT2 : "FFFFFF" });
    s.addText(r[0], { x: MX + 0.16, y: y + 0.08, w: 2.75, h: 0.7, fontFace: F, fontSize: 9,
      bold: true, color: INK, margin: 0, isTextBox: true, valign: "top" });
    chip(s, MX + 3.0, y + 0.26, 0.55, r[1] === "L" ? "LOW" : "MED", r[2], r[3], 7.5);
    s.addText(r[4], { x: MX + 3.7, y: y + 0.08, w: lw - 3.9, h: 0.7, fontFace: F, fontSize: 8.5,
      color: INK, margin: 0, isTextBox: true, valign: "top" });
  });
  s.addText("Chip = residual risk after mitigation. Column: risk · residual · countermeasure shipped in the prototype today.", {
    x: MX, y: 6.98, w: lw, h: 0.22, fontFace: F, fontSize: 7.5, italic: true, color: FAINT,
    margin: 0, isTextBox: true });
  // right column: scope + ask
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  card(s, rx, 1.4, rw, 2.35, { fill: AMBERT, border: AMBERT });
  icon(s, "FcInspection", rx + rw - 0.58, 1.52, 0.38);
  label(s, rx + 0.2, 1.53, "Stated scope - said before you ask", AMBER, rw - 1.0);
  s.addText(
    "Eval rates come from a 3,488-record seeded synthetic benchmark - labels true by construction; real-traffic rates are established in the shadow phase (that is what it is for). Lite profile = deterministic + lexical detectors; NLI and LLM-judge adapters are integrated but optional - values under 10 (a '3-year' vs '1-year' claim) are their job, not the lexical path's. A blind hold-out slot, authored by whoever didn't build the detectors, is scored separately.",
    { x: rx + 0.2, y: 1.82, w: rw - 0.4, h: 1.85, fontFace: F, fontSize: 9.5, color: INK,
      margin: 0, isTextBox: true, valign: "top" });
  card(s, rx, 3.95, rw, 3.01, { fill: DEEP, border: DEEP });
  iconBadge(s, "FcOk", rx + rw - 0.62, 4.08, 0.42);
  label(s, rx + 0.2, 4.1, "The ask - verify in 10 min", "D9B8FF", rw - 1.0);
  const cmds = [
    ["docker compose up --build", "gateway + operator console on :8080"],
    ["python -m demo.run_demo", "the 10-act scripted demo, fully offline"],
    ["python -m evals.run", "reproduce every number in this proposal"],
  ];
  cmds.forEach((c, i) => {
    const y = 4.48 + i * 0.8;
    s.addShape("roundRect", { x: rx + 0.2, y, w: rw - 0.4, h: 0.34, rectRadius: 0.06,
      fill: { color: "2E0A4E" }, line: { type: "none" } });
    s.addText(c[0], { x: rx + 0.32, y, w: rw - 0.6, h: 0.34, fontFace: "Courier New",
      fontSize: 9.5, bold: true, color: "7FFFB0", valign: "middle", margin: 0, isTextBox: true });
    s.addText(c[1], { x: rx + 0.2, y: y + 0.36, w: rw - 0.4, h: 0.24, fontFace: F, fontSize: 8,
      color: "D9B8FF", margin: 0, isTextBox: true });
  });
  footer(s, "All mitigations verifiable in the repository: tests (53 passing), demo acts 7-9 (failure modes), policy packs, ledger verification endpoint.");
}

// ============================================================ 11 · APPENDIX
{
  const s = pres.addSlide();
  s.background = { color: BGC };
  header(s, "A", "Appendix", "Every number in this deck, its source file, and the command that reproduces it");
  const lw = 7.4;
  card(s, MX, 1.4, lw, 2.95);
  icon(s, "FcBarChart", MX + lw - 0.56, 1.5, 0.36);
  label(s, MX + 0.2, 1.52, "Measured results - test split, 2,381 of 3,488 seeded records", DEEP, lw - 0.6);
  const evalRows = [
    [{ text: "Risk category", options: { bold: true } }, { text: "Recall", options: { bold: true } },
     { text: "95% CI", options: { bold: true } }, { text: "False flags", options: { bold: true } }],
    ["Grounding (unsupported claim)", "96.4% (402/417)", "[94.2, 97.8]", "0 / 1,964"],
    ["Privacy (PII)", "100% (132/132)", "[97.2, 100]", "0 / 2,249"],
    ["Toxicity / harmful language", "100% (96/96)", "[96.2, 100]", "0 / 2,285"],
    ["Prompt injection (incl. indirect)", "100% (68/68)", "[94.7, 100]", "0 / 2,313"],
    ["Cost anomalies", "100% (26/26)", "[87.1, 100]", "0 / 2,355"],
  ];
  s.addTable(evalRows.map(r => r.map(c => typeof c === "string"
      ? { text: c, options: { color: INK, fontSize: 9 } }
      : { text: c.text, options: { ...c.options, color: DEEP, fontSize: 9 } })), {
    x: MX + 0.2, y: 1.86, w: lw - 0.4, colW: [2.9, 1.7, 1.2, 1.2],
    border: { type: "solid", color: BORDER, pt: 0.5 }, fill: { color: "FFFFFF" },
    fontFace: F, valign: "middle", margin: 0.04, autoPage: false,
  });
  s.addText("Action gate 41/41 tainted held · 0/47 false holds  |  abstention 43/43  |  ECE 0.065  |  labels are true by construction (failures injected on purpose)",
    { x: MX + 0.2, y: 4.02, w: lw - 0.4, h: 0.26, fontFace: F, fontSize: 8, italic: true,
      color: MUTED, margin: 0, isTextBox: true });
  card(s, MX, 4.52, lw, 2.44, { fill: TINT2 });
  icon(s, "FcLink", MX + lw - 0.56, 4.62, 0.36);
  label(s, MX + 0.2, 4.64, "Where each deck number lives", MIDP, lw - 0.6);
  const srcMap = [
    ["96.4-100% recall · CIs · 0 false flags · ECE", "evals/out/results.json"],
    ["Recall vs FP threshold curves (operating point)", "evals/out/operating_sweep.json"],
    ["12.6 ms p50 · 20.3 ms p95 · 108 req/s · 0.04% spend", "evals/out/load_test.json"],
    ["₹103,467 vs ₹100,000 turn-7 escalation", "demo act 6 (deterministic, offline)"],
    ["4.8× ROI floor · ₹25L cost · scenario band", "stated assumptions (section 05)"],
  ];
  srcMap.forEach((r, i) => {
    const y = 4.98 + i * 0.38;
    s.addText(r[0], { x: MX + 0.2, y, w: 4.35, h: 0.32, fontFace: F, fontSize: 8.5,
      color: INK, margin: 0, isTextBox: true });
    s.addText(r[1], { x: MX + 4.6, y, w: lw - 4.8, h: 0.32, fontFace: "Courier New",
      fontSize: 8, bold: true, color: MIDP, margin: 0, isTextBox: true });
  });
  const rx = MX + lw + 0.3, rw = W - MX - rx;
  card(s, rx, 1.4, rw, 2.62, { fill: DEEP, border: DEEP });
  iconBadge(s, "FcSettings", rx + rw - 0.62, 1.52, 0.42);
  label(s, rx + 0.2, 1.54, "Reproduce everything", "D9B8FF", rw - 0.7);
  const cmds = [
    ["python -m pytest tests/", "53 tests on the mechanisms"],
    ["python -m evals.generate", "3,488-record dataset, byte-identical"],
    ["python -m evals.run", "recall, CIs, calibration, sweep"],
    ["python -m demo.run_demo", "10-act scripted demo, offline"],
  ];
  cmds.forEach((c, i) => {
    const y = 1.92 + i * 0.52;
    s.addShape("roundRect", { x: rx + 0.2, y, w: rw - 0.4, h: 0.28, rectRadius: 0.05,
      fill: { color: "2E0A4E" }, line: { type: "none" } });
    s.addText(c[0], { x: rx + 0.3, y, w: rw - 0.55, h: 0.28, fontFace: "Courier New",
      fontSize: 8.5, bold: true, color: "7FFFB0", valign: "middle", margin: 0, isTextBox: true });
    s.addText(c[1], { x: rx + 0.2, y: y + 0.28, w: rw - 0.4, h: 0.2, fontFace: F,
      fontSize: 7.5, color: "D9B8FF", margin: 0, isTextBox: true });
  });
  card(s, rx, 4.22, rw, 2.74, { fill: AMBERT, border: AMBERT });
  icon(s, "FcRules", rx + rw - 0.56, 4.32, 0.36);
  label(s, rx + 0.2, 4.34, "Assumption register", AMBER, rw - 0.7);
  const asum = [
    "Volume 2.1M interactions/yr - the brief's own parameter",
    "Material-failure rate 1.0% - measured in shadow phase",
    "₹600 per failure reaching a user (remediation + concession)",
    "Severity table signed by the client's risk office at land",
    "Model cost ₹0.04/1K tokens · judge call ₹0.05 (config.py)",
    "Severities and budgets are policy-pack data, not code",
  ];
  asum.forEach((a, i) => checkRow(s, rx + 0.2, 4.64 + i * 0.37, rw - 0.4, a, 8.5));
  footer(s, "Public repository: all files above ship in the repo; a fresh clone reproduces this table with three commands.");
}

pres.writeFile({ fileName: "ControlPlane_Business_Proposal.pptx" }).then(() => {
  console.log("written: ControlPlane_Business_Proposal.pptx (case edition), slides:", pageNo);
});


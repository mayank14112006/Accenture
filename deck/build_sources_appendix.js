// One-page appendix: every data point in the proposal -> its exact source.
const pptxgen = require("pptxgenjs");
const fs = require("fs");

const BGC = "FFFFFF";
const INK = "1E1E28", MUTED = "6A6E78", FAINT = "9AA0AA";
const PURPLE = "A100FF", DEEP = "460073", MIDP = "7500C0";
const TINT = "F6EFFF", TINT2 = "FBF8FF", BORDER = "E4DCEF";
const GREEN = "188038", GREENT = "E6F4EA";
const AMBER = "B26A00", AMBERT = "FEF3E0";
const BLUE = "1A73E8";
const F = "Arial";
const W = 13.33, H = 7.5, MX = 0.45;
const CW = W - 2 * MX;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { bodyFontFace: F, headFontFace: F };

function icon(s, name, x, y, size) {
  const p = `icons/${name}.png`;
  if (!fs.existsSync(p)) return;
  s.addImage({ path: p, x, y, w: size || 0.34, h: size || 0.34 });
}
function card(s, x, y, w, h, opts = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06,
    fill: { color: opts.fill || "FFFFFF" },
    line: { color: opts.border || BORDER, width: 1 } });
}
function label(s, x, y, text, color, w) {
  s.addText(text.toUpperCase(), { x, y, w: w || 5, h: 0.22, fontFace: F,
    fontSize: 9.5, bold: true, color: color || MUTED, charSpacing: 2, margin: 0, isTextBox: true });
}
function row(s, x, y, w, what, src, srcMono) {
  s.addText(what, { x, y, w: w * 0.52, h: 0.34, fontFace: F, fontSize: 8.5,
    color: INK, margin: 0, isTextBox: true, valign: "top" });
  s.addText(src, { x: x + w * 0.53, y, w: w * 0.47, h: 0.34,
    fontFace: srcMono ? "Courier New" : F, fontSize: srcMono ? 6.8 : 8,
    bold: srcMono, color: srcMono ? MIDP : MUTED, margin: 0, isTextBox: true, valign: "top" });
}

const s = pres.addSlide();
s.background = { color: BGC };
s.addShape("roundRect", { x: MX, y: 0.3, w: 0.52, h: 0.52, rectRadius: 0.08,
  fill: { color: DEEP }, line: { type: "none" } });
s.addText("A", { x: MX, y: 0.3, w: 0.52, h: 0.52, fontFace: F, fontSize: 16,
  bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
s.addText("APPENDIX · DATA SOURCES", { x: MX + 0.68, y: 0.3, w: CW - 0.68, h: 0.24,
  fontFace: F, fontSize: 10, bold: true, color: MIDP, charSpacing: 2.5, margin: 0, isTextBox: true });
s.addText("Every data point in this proposal and exactly where it comes from",
  { x: MX + 0.68, y: 0.53, w: CW - 0.68, h: 0.4, fontFace: F, fontSize: 19.5,
    bold: true, color: INK, margin: 0, isTextBox: true });

const colW = (CW - 0.5) / 3;

// ---- column 1: measured, file-backed ----------------------------------
const c1 = MX;
card(s, c1, 1.15, colW, 5.3, { fill: TINT2 });
icon(s, "FcBarChart", c1 + colW - 0.52, 1.27, 0.34);
label(s, c1 + 0.18, 1.29, "Measured - file in the repository", DEEP, colW - 0.7);
const measured = [
  ["Grounding recall 96.4% (402/417) + 95% CI", "evals/out/results.json", 1],
  ["Privacy / toxicity / injection / cost recall 100%", "evals/out/results.json", 1],
  ["0 false flags per category (1,964-2,355 benign)", "evals/out/results.json", 1],
  ["Action gate 41/41 held · 0/47 false holds", "evals/out/results.json", 1],
  ["Abstention 43/43 · ECE 0.065", "evals/out/results.json", 1],
  ["Recall vs FP-rate curves by threshold", "out/operating_sweep.json", 1],
  ["Per-detector probability calibration", "evals/out/calibration.json", 1],
  ["Coverage weights (risk-weighted recall)", "out/coverage_weights.json", 1],
  ["12.6 ms p50 · 20.3 ms p95 added latency", "evals/out/load_test.json", 1],
  ["108 req/s saturation · 0.04% of model spend", "evals/out/load_test.json", 1],
  ["Dataset: 3,488 records, 2,381 test, ~28% injected", "evals/generate.py (seed 20260823)", 1],
  ["Turn-7 escalation ₹103,467 vs ₹100,000", "demo/run_demo.py - act 6", 1],
  [">96% of checks with no LLM call", "demo act 10 + results.json", 1],
  ["53 passing tests", "tests/ (python -m pytest)", 1],
];
measured.forEach((r, i) => row(s, c1 + 0.18, 1.62 + i * 0.34, colW - 0.36, r[0], r[1], r[2]));

// ---- column 2: stated assumptions --------------------------------------
const c2 = MX + colW + 0.25;
card(s, c2, 1.15, colW, 5.3, { fill: AMBERT, border: AMBERT });
icon(s, "FcRules", c2 + colW - 0.52, 1.27, 0.34);
label(s, c2 + 0.18, 1.29, "Stated assumptions - where declared", AMBER, colW - 0.7);
const assumed = [
  ["Volume 40,000/week = 2.1M interactions/yr", "Round 2 brief, reference parameters", 0],
  ["Three lanes: support, copilot, decision-support", "Round 2 brief, reference parameters", 0],
  ["Mixed well-/loosely-governed sources", "Round 2 brief, reference parameters", 0],
  ["Material-failure rate 1.0% (measured in shadow)", "proposal section 05 - assumption", 0],
  ["Catch rate 95% (benchmark-derived, rounded)", "proposal section 05 - assumption", 0],
  ["₹600 remediation + concession per failure", "proposal section 05 - assumption", 0],
  ["All-in cost ≈ ₹25L/yr incl. ₹7L triage bench", "proposal section 05 - worked example", 0],
  ["ROI floor 4.8× · band ₹30L-₹1.5Cr separate", "arithmetic over the rows above", 0],
  ["Episode budget ₹100,000 · severity table", "decision_support.yaml", 1],
  ["Latency budgets 150 ms / 1.5 s / gate mode", "policies/*.yaml (3 packs)", 1],
  ["Model cost ₹0.04/1K tokens · judge ₹0.05", "controlplane/config.py", 1],
  ["Severities signed by client risk office at land", "GTM design, section 06", 0],
];
assumed.forEach((r, i) => row(s, c2 + 0.18, 1.62 + i * 0.38, colW - 0.36, r[0], r[1], r[2]));

// ---- column 3: external / public ---------------------------------------
const c3 = MX + 2 * (colW + 0.25);
card(s, c3, 1.15, colW, 5.3);
icon(s, "FcGlobe", c3 + colW - 0.52, 1.27, 0.34);
label(s, c3 + 0.18, 1.29, "External & public sources", BLUE, colW - 0.7);
const external = [
  ["“Compounding risk” quote & brief requirements", "AIC 2026 Round 2 problem statement, Track 1", 0],
  ["10/11 agents bypassed shell guards", "GuardFall - 2026 agent-security research (public)", 0],
  ["Agent memory poisoned by one email", "MemGhost - 2026 agent-security research (public)", 0],
  ["Review modes steered by hostile repo content", "Friendly Fire - 2026 agent-security research (public)", 0],
  ["~20% of organisations report mature AI governance", "Deloitte AI governance survey, 2026", 0],
  ["Human-oversight duty for high-risk AI", "EU AI Act, Article 14", 0],
  ["Hallucination failure archetypes in eval data", "HaluEval · RAGTruth (public benchmarks)", 0],
  ["Jailbreak / injection archetypes in eval data", "JailbreakBench (public benchmark)", 0],
  ["PII patterns in eval data", "Microsoft Presidio (open source)", 0],
  ["Sub-200 ms guardrails are commodity; session observability", "Fiddler · Galileo · Arthur public positioning, 2026", 0],
  ["Bundled content guardrails", "AWS Bedrock / Azure AI public docs, 2026", 0],
  ["Gateway guardrail hooks", "LiteLLM · Portkey public docs, 2026", 0],
  ["Third-party attribution", "repository NOTICE file (Apache-2.0)", 1],
];
external.forEach((r, i) => row(s, c3 + 0.18, 1.62 + i * 0.36, colW - 0.36, r[0], r[1], r[2]));

// ---- bottom: reproduce strip -------------------------------------------
card(s, MX, 6.6, CW, 0.62, { fill: DEEP, border: DEEP });
s.addText([
  { text: "Reproduce the measured column from a fresh clone:  ", options: { color: "D9B8FF", fontSize: 9.5, bold: true } },
  { text: "python -m pytest tests/", options: { color: "7FFFB0", fontSize: 9.5, bold: true, fontFace: "Courier New" } },
  { text: "   →   ", options: { color: "D9B8FF", fontSize: 9.5 } },
  { text: "python -m evals.generate && python -m evals.run", options: { color: "7FFFB0", fontSize: 9.5, bold: true, fontFace: "Courier New" } },
  { text: "   →   ", options: { color: "D9B8FF", fontSize: 9.5 } },
  { text: "python -m scripts.load_test", options: { color: "7FFFB0", fontSize: 9.5, bold: true, fontFace: "Courier New" } },
  { text: "   -  the dataset is seeded, so every number regenerates byte-identically.", options: { color: "D9B8FF", fontSize: 9 } },
], { x: MX + 0.25, y: 6.6, w: CW - 0.5, h: 0.62, fontFace: F, valign: "middle", margin: 0, isTextBox: true });

s.addText("Repository: github.com/mayank14112006/Accenture · nothing in the proposal is asserted without a line on this page",
  { x: MX, y: 7.26, w: 9.5, h: 0.22, fontFace: F, fontSize: 7.5, color: FAINT, margin: 0, isTextBox: true });
s.addText("ControlPlane · Detailed Business Proposal · Appendix",
  { x: W - 4.0, y: 7.26, w: 4.0 - MX, h: 0.22, fontFace: F, fontSize: 7.5,
    color: FAINT, align: "right", margin: 0, isTextBox: true });

pres.writeFile({ fileName: "ControlPlane_Appendix_Sources.pptx" }).then(() =>
  console.log("written: ControlPlane_Appendix_Sources.pptx (1 slide)"));

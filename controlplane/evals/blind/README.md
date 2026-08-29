# Blind hold-out (`holdout_v1.jsonl`)

52 hand-written cases, authored **without reference to the detector source code or
to `evals/generate.py`'s phrasings**, and never used for tuning. `evals/run.py`
scores anything in this directory separately from the seeded benchmark
(anti-circularity) — the results land under `blind_holdout` in
`evals/out/results.json`.

**Authorship, stated plainly:** these cases were written by Team Pluoton for this
submission. Best practice is authorship by someone who did not build the detectors
at all; within a small team we approximate that by (a) writing from failure-mode
descriptions rather than code, (b) deliberately using formats the seeded generator
never emits, and (c) committing the set before scoring it, tuning nothing
afterwards.

What it deliberately probes (formats absent from the seeded set):

- paraphrased unsupported claims, including entity-less ones the lexical path is
  documented to miss
- figures as mixed words/digits across lakh–crore notation ("about 2.1 lakh" vs
  ₹1,84,000; "₹3,20,00,000" vs "₹2.4 crore")
- PII in unusual shapes: spelled-out phone digits, name + DOB, spaced Aadhaar,
  PAN, partially-masked bank details
- obfuscated injections: base64 payloads, "as per the admin note above",
  HTML-comment payloads, and an indirect injection inside a low-trust source
- a fabricated-in-words → tool-call-in-digits taint chain, plus a clean gate case
- ~40% clean benign traffic, including derived values (GST) and grounded
  lakh-word restatements that must NOT flag

Expect recall **below** the seeded benchmark here — that is the point of a blind
set, and the numbers are reported as measured, never tuned against.

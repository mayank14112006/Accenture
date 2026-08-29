# ControlPlane — episode-level assurance for enterprise AI

**Accenture Innovation Challenge 2026 · Round 2 · Problem Track 1 (ControlPlane.ai) · Team Pluoton**

Existing guardrails ask: *is this response safe?*
ControlPlane asks: **is this task still safe, given everything that has already happened in it?**

> **[▶ Watch the 3-minute prototype demo](VIDEO_LINK_HERE)** — replace before submission.

## Where to go

- **Prototype** (gateway, dashboard, evals, demo, tests) → [`controlplane/README.md`](controlplane/README.md)
- **Business proposal** → [`docs/ControlPlane_Business_Proposal.pdf`](docs/ControlPlane_Business_Proposal.pdf)
- **Solution design** → [`AIC-Round2-Solution-Design.md`](AIC-Round2-Solution-Design.md)
- Problem statement: distributed via the AIC portal.

## Quickstart

```bash
git clone https://github.com/mayank14112006/Accenture.git
cd Accenture/controlplane
docker compose up --build   # gateway + console on http://localhost:8080
```

Fully offline — no API keys, no model downloads. Wait for `/ready`, then open the console.

## Reproduce every measured number

From `controlplane/`, on a clean Python 3.11+ venv:

```bash
pip install -r requirements.txt
python -m pytest tests/               # all tests
python -m evals.generate              # seeded dataset — byte-identical every run
python -m evals.run                   # recall / CI / gate / abstention / ECE
python -m scripts.load_test           # latency + throughput probe
```

Dataset, recall, confidence intervals, false-flag counts, gate results, abstention
counts and ECE reproduce **exactly**. Timing and cost-percentage figures
(latency, throughput, assurance-spend %) are hardware-dependent; the quoted values
come from the committed `controlplane/evals/out/load_test.json` (machine recorded
in the file).

Apache-2.0. Dataset/model attributions in `controlplane/NOTICE`.

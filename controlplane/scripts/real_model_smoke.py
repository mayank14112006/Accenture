"""Real-model smoke run — the eval suite measures the sim provider; this script
pushes a 50-record slice of the same dataset through a LIVE OpenAI-compatible
endpoint so there is real-model evidence on file.

    OPENAI_API_KEY=... [OPENAI_BASE_URL=... OPENAI_MODEL=...] \
        python -m scripts.real_model_smoke
    # or CP_PROVIDER=gemini GEMINI_API_KEY=... python -m scripts.real_model_smoke
    # or against a deployed gateway that already holds the provider key:
    # CP_GATEWAY_URL=https://your-app.onrender.com python -m scripts.real_model_smoke

The real model writes its own outputs, so there is no ground-truth label check
here — what gets recorded is what assurance DID on live traffic: the decision,
risk probabilities and added latency per request, plus aggregates. Output:
evals/out/real_model_smoke.json (machine + model fingerprint recorded).
"""
from __future__ import annotations

import json
import os
import platform
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CP_DATA_DIR", str(ROOT / "data"))
os.environ.setdefault("CP_PROVIDER", "openai")   # this script exists for live runs

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Remote mode: point at an already-deployed gateway (which holds its own
# provider key) instead of running the app in-process with a local key:
#     CP_GATEWAY_URL=https://your-app.onrender.com python -m scripts.real_model_smoke
GATEWAY_URL = os.getenv("CP_GATEWAY_URL", "").rstrip("/")

provider = os.environ["CP_PROVIDER"]
if not GATEWAY_URL:
    if provider == "openai" and not (os.getenv("OPENAI_API_KEY") or
                                     os.getenv("OPENAI_BASE_URL", "").startswith("http://")):
        sys.exit("set OPENAI_API_KEY (any OpenAI-compatible endpoint; OPENAI_BASE_URL "
                 "to point elsewhere), CP_PROVIDER=gemini + GEMINI_API_KEY, or "
                 "CP_GATEWAY_URL=<deployed gateway> to use a remote deployment's key")
    if provider == "gemini" and not os.getenv("GEMINI_API_KEY"):
        sys.exit("CP_PROVIDER=gemini requires GEMINI_API_KEY (or set CP_GATEWAY_URL "
                 "to use a deployed gateway that already has it)")

from fastapi.testclient import TestClient  # noqa: E402

if not GATEWAY_URL:
    from controlplane.main import app  # noqa: E402


def make_client():
    if GATEWAY_URL:
        import httpx
        return httpx.Client(base_url=GATEWAY_URL, timeout=120.0)
    return TestClient(app)

SLICE = 50
DATA = ROOT / "evals" / "data" / "dataset.jsonl"


def pick_slice() -> list[dict]:
    """Deterministic, label-stratified 50-record slice of the test split
    (single-turn only — the real model answers each prompt independently)."""
    records = [json.loads(l) for l in DATA.read_text(encoding="utf-8").splitlines()
               if l.strip()]
    per_label: dict[str, list[dict]] = {}
    for r in records:
        if r.get("split") != "test" or r.get("episode"):
            continue
        key = ",".join(sorted(r["labels"])) or "benign"
        per_label.setdefault(key, []).append(r)
    picked: list[dict] = []
    quota = {"benign": 20}
    for key in sorted(per_label):
        picked.extend(per_label[key][: quota.get(key, 6)])
    return picked[:SLICE]


def main() -> None:
    rows = []
    gateway_provider = provider
    with make_client() as client:
        try:
            client.get("/ready")
        except Exception as e:
            sys.exit(f"gateway unreachable at {GATEWAY_URL or 'in-process'}: {e}")
        if GATEWAY_URL:   # the deployment knows its own provider; env doesn't
            try:
                gateway_provider = client.get("/admin/metrics").json().get(
                    "provider", "unknown")
            except Exception:
                gateway_provider = "unknown"
            if gateway_provider == "sim":
                sys.exit(f"{GATEWAY_URL} is running the SIM provider - its output "
                         "would not be real-model evidence. Set CP_PROVIDER=gemini "
                         "(or openai) + the API key on the deployment and redeploy.")
        for i, rec in enumerate(pick_slice(), 1):
            body = {
                "messages": [{"role": "user", "content": rec["user_text"]}],
                "cp_use_case": rec["use_case"],
                "cp_episode_id": f"smoke-{rec['id']}",
                "cp_identity": f"smoke-ident-{rec['id']}",
            }
            if rec.get("sources"):
                body["cp_sources"] = rec["sources"]
            t0 = time.perf_counter()
            r = client.post("/v1/chat/completions", json=body)
            wall_ms = (time.perf_counter() - t0) * 1000
            cp = r.json().get("controlplane", {})
            rows.append({
                "id": rec["id"], "use_case": rec["use_case"],
                "dataset_labels": rec["labels"],
                "decision": cp.get("decision"),
                "risk": cp.get("risk"),
                "added_latency_ms": cp.get("added_latency_ms"),
                "end_to_end_ms": round(wall_ms, 1),
                "model_fingerprint": cp.get("model_fingerprint"),
            })
            print(f"[{i:02d}/{SLICE}] {rec['id']} -> {cp.get('decision')} "
                  f"(+{cp.get('added_latency_ms')} ms assurance)")

    added = sorted(x["added_latency_ms"] for x in rows if x["added_latency_ms"] is not None)
    result = {
        "note": ("live-model smoke evidence: decisions + latency on real outputs. "
                 "No recall is computed - the real model's outputs have no injected "
                 "ground truth; headline recall numbers come from the seeded eval "
                 "(sim provider) and the blind hold-out."),
        "provider": gateway_provider,
        "gateway": GATEWAY_URL or "in-process",
        "model": (rows[0].get("model_fingerprint") if rows else None)
                 or os.getenv("OPENAI_MODEL") or os.getenv("GEMINI_MODEL") or "(default)",
        "machine": platform.node() or "unknown",
        "ran_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "records": len(rows),
        "decisions": dict(Counter(x["decision"] for x in rows)),
        "assurance_added_ms": {
            "p50": added[len(added) // 2] if added else None,
            "p95": added[int(len(added) * 0.95) - 1] if added else None,
        },
        "rows": rows,
    }
    out = ROOT / "evals" / "out" / "real_model_smoke.json"
    out.write_text(json.dumps(result, indent=1))
    print(f"\nwrote {out}")
    print("decisions:", result["decisions"])


if __name__ == "__main__":
    main()

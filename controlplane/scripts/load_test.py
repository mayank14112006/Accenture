"""Load test — proves the throughput/latency claims with measured numbers.

    python -m scripts.load_test [requests] [concurrency]

Runs realistic mixed traffic (70% benign, 30% failure archetypes, ~250-token
responses) against the in-process ASGI app (no network noise; the pipeline is
what is being measured). Reports end-to-end and assurance-overhead percentiles
and writes evals/out/load_test.json so the deck quotes a reproducible number.
"""
from __future__ import annotations

import asyncio
import json
import os
import random
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
os.environ.setdefault("CP_DATA_DIR", str(ROOT / "evals" / "out" / "data-load"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp1252 consoles

import httpx  # noqa: E402

from controlplane.main import app  # noqa: E402
from controlplane.telemetry import telemetry  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
CONC = int(sys.argv[2]) if len(sys.argv) > 2 else 32

_SENTS = [
    "The request has been reviewed against the applicable records.",
    "Our resolution desk confirmed the courier partner's pickup schedule.",
    "You will receive a confirmation message once the transfer initiates.",
    "No further documentation is required from your side at this stage.",
    "The service reference stays active until the credit is completed.",
    "Standard processing applies as per the published timeline.",
    "Please retain the order reference for any follow-up queries.",
    "Our records show the request progressing through clearance normally.",
]


def _filler(rng: random.Random, n_sent: int = 16) -> str:
    # varied sentences (~250 tokens) — verbatim-repeated filler would rightly
    # trip the repetition-loop cost detector
    return " ".join(rng.choice(_SENTS) for _ in range(n_sent))


def make_request(rng: random.Random, i: int) -> dict:
    order = f"ORD-{rng.randint(100000, 999999)}"
    amount = rng.randint(1000, 40000)
    src = [{"id": f"crm-{order}", "trust": "governed",
            "text": f"Order {order}: amount ₹{amount:,}, refund approved, "
                    f"dispatched 5 March 2026."}]
    body_base = {"cp_use_case": "customer_support", "cp_episode_id": f"lt-{i}",
                 "cp_identity": f"lt-user-{i % 200}", "cp_sources": src,
                 "messages": [{"role": "user",
                               "content": f"Status of my refund for {order}?"}]}
    roll = rng.random()
    filler = _filler(rng)
    if roll < 0.70:
        out = (f"Your refund for order {order} of ₹{amount:,} was approved. "
               + filler)
    elif roll < 0.80:
        out = (f"The refund of ₹{amount:,} is approved; we notified "
               f"customer.name@example.com and +91 98765 43210. " + filler)
    elif roll < 0.90:
        out = (f"Your refund for order {order} of ₹{int(amount * 2.3):,} was "
               f"already credited on 30 December 2026. " + filler)
    else:
        out = "Honestly, only an idiot would lose this confirmation. " + filler
    body_base["cp_sim"] = {"output": out}
    return body_base


async def _phase(client, requests, conc):
    latencies: list[float] = []
    errors = 0
    sem = asyncio.Semaphore(conc)

    async def one(body):
        nonlocal errors
        async with sem:
            t0 = time.perf_counter()
            r = await client.post("/v1/chat/completions", json=body)
            latencies.append((time.perf_counter() - t0) * 1000)
            if r.status_code != 200:
                errors += 1

    t0 = time.perf_counter()
    await asyncio.gather(*(one(b) for b in requests))
    wall = time.perf_counter() - t0
    lat = sorted(latencies)

    def pct(p):
        return round(lat[min(len(lat) - 1, int(p / 100 * len(lat)))], 2)

    return {"requests": len(requests), "concurrency": conc, "errors": errors,
            "wall_seconds": round(wall, 2),
            "throughput_rps": round(len(requests) / wall, 1),
            "end_to_end_ms": {"p50": pct(50), "p95": pct(95), "p99": pct(99),
                              "mean": round(statistics.mean(lat), 2)}}


async def main() -> None:
    """Two honest measurements, reported separately:
    - LATENCY PROBE at concurrency 2: what one request actually costs
      (per-request assurance overhead, no queueing artefacts);
    - THROUGHPUT at saturation: sustained rps of a single instance —
      p95 there measures queueing, and is labelled as such."""
    import platform
    rng = random.Random(7)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cp",
                                 timeout=60) as client:
        async with app.router.lifespan_context(app):
            telemetry.__init__()
            probe = await _phase(client, [make_request(rng, i)
                                          for i in range(300)], conc=2)
            probe_added = telemetry.snapshot()["latency_ms"]
            telemetry.__init__()
            sat = await _phase(client, [make_request(rng, 1000 + i)
                                        for i in range(N)], conc=CONC)
            snap = telemetry.snapshot()

    result = {
        "latency_probe": {**probe, "assurance_added_ms": probe_added},
        "throughput_saturation": {
            **sat,
            "note": "p95 at saturation measures queueing on one CPU-bound "
                    "instance; scale-out is horizontal (stateless gateway, "
                    "episode store shardable by episode_id)"},
        "coverage_p50": snap["coverage_p50"],
        "decisions_at_saturation": snap["decisions"],
        "cost_inr": snap["cost_inr"],
        "traffic": "mixed (~70% benign / 10% PII / 10% hallucination / 10% "
                   "toxicity), ~250-token responses, lite profile, in-process ASGI",
        "machine": platform.node() or "unknown",
    }
    out = ROOT / "evals" / "out" / "load_test.json"
    out.write_text(json.dumps(result, indent=1))
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    asyncio.run(main())

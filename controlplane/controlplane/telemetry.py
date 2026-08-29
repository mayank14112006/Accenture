"""In-app telemetry: latency histograms, decision mix, cost accounting,
LLM vs non-LLM breakdown. Exposed as one JSON endpoint the dashboard polls.
(OpenTelemetry export is a production-roadmap item, deliberately not a
prototype dependency.)"""
from __future__ import annotations

import time
from collections import Counter, defaultdict


class Reservoir:
    """Fixed-size sample for percentile estimates."""

    def __init__(self, size: int = 2000) -> None:
        self.size = size
        self.values: list[float] = []
        self.n = 0

    def add(self, v: float) -> None:
        self.n += 1
        if len(self.values) < self.size:
            self.values.append(v)
        else:
            import random
            i = random.randrange(self.n)
            if i < self.size:
                self.values[i] = v

    def percentile(self, p: float) -> float:
        if not self.values:
            return 0.0
        s = sorted(self.values)
        k = min(len(s) - 1, max(0, int(round(p / 100 * (len(s) - 1)))))
        return round(s[k], 2)


class Telemetry:
    def __init__(self) -> None:
        self.started = time.time()
        self.decisions = Counter()
        self.by_use_case: dict[str, Counter] = defaultdict(Counter)
        self.added_latency = Reservoir()        # assurance overhead per request (ms)
        self.ttft = Reservoir()                 # time to first token (stream)
        self.inter_sentence_gap = Reservoir()   # stream stutter (ms)
        self.detector_ms: dict[str, Reservoir] = defaultdict(Reservoir)
        self.coverage = Reservoir()
        self.tokens_in = 0
        self.tokens_out = 0
        self.model_calls = 0                    # upstream generation calls
        self.judge_calls = 0                    # Tier-2 LLM calls
        self.repair_count = 0
        self.model_cost_inr = 0.0
        self.assurance_cost_inr = 0.0
        self.avoided_loss_inr = 0.0             # severity of blocked/held/repaired failures
        self.gate_holds = 0
        self.escalations = 0
        self.degraded_requests = 0
        self.non_llm_checks = 0                 # detector passes with no model call
        self.llm_checks = 0

    def snapshot(self) -> dict:
        model_cost = self.model_cost_inr or 1e-9
        return {
            "uptime_s": round(time.time() - self.started, 1),
            "decisions": dict(self.decisions),
            "by_use_case": {k: dict(v) for k, v in self.by_use_case.items()},
            "latency_ms": {
                "added_p50": self.added_latency.percentile(50),
                "added_p95": self.added_latency.percentile(95),
                "added_p99": self.added_latency.percentile(99),
                "ttft_p50": self.ttft.percentile(50),
                "ttft_p95": self.ttft.percentile(95),
                "inter_sentence_gap_p95": self.inter_sentence_gap.percentile(95),
            },
            "detector_ms_p95": {k: r.percentile(95) for k, r in self.detector_ms.items()},
            "coverage_p50": self.coverage.percentile(50),
            "tokens": {"in": self.tokens_in, "out": self.tokens_out},
            "model_calls": self.model_calls,
            "judge_calls": self.judge_calls,
            "repairs": self.repair_count,
            "gate_holds": self.gate_holds,
            "escalations": self.escalations,
            "degraded_requests": self.degraded_requests,
            "llm_vs_non_llm": {
                "non_llm_detector_passes": self.non_llm_checks,
                "llm_detector_passes": self.llm_checks,
                "pct_traffic_llm_checked": round(
                    100 * self.llm_checks / max(1, self.llm_checks + self.non_llm_checks), 2),
            },
            "cost_inr": {
                "model_spend": round(self.model_cost_inr, 4),
                "assurance_spend": round(self.assurance_cost_inr, 4),
                "assurance_pct_of_model_spend": round(
                    100 * self.assurance_cost_inr / model_cost, 2),
                "avoided_loss_illustrative": round(self.avoided_loss_inr, 2),
                "note": ("cost rates and severities are stated assumptions; "
                         "see policy packs and config.py"),
            },
        }


telemetry = Telemetry()

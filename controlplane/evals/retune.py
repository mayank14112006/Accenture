"""Threshold retune proposals from quarantined reviewer feedback.

Reads applied overrides from the FeedbackStore, aggregates per-category
overturn rates, and emits PROPOSED flag-threshold deltas to
evals/out/retune_proposal.json. Proposals only — nothing is ever applied
automatically (consistent with the stated "no online learning" posture):
a human takes the proposal to POST /admin/operating-point or edits the
pack YAML, which bumps the version and re-signs.

    python -m evals.retune
"""
from __future__ import annotations

import json
import os
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("CP_DATA_DIR", str(ROOT / "evals" / "out" / "data"))

from controlplane.feedback import FeedbackStore  # noqa: E402
from controlplane.policy import PolicyEngine     # noqa: E402

# An overturned flag is a reviewer-confirmed false positive. Only propose a
# nudge when the evidence is more than anecdote, and never a big one.
MIN_OVERRIDES_PER_CATEGORY = 5
OVERTURN_RATE_TRIGGER = 0.30
FLAG_DELTA = 0.05
FLAG_CEILING = 0.80          # a flag threshold this high stops flagging at all


def build_proposal(store: FeedbackStore, engine: PolicyEngine) -> dict:
    counts: dict[str, dict[str, int]] = defaultdict(lambda: {"confirm": 0, "overturn": 0})
    for ov in store.all(limit=10_000):
        if ov["state"] != "applied":
            continue                       # pending two-person approvals don't count
        for cat in filter(None, (c.strip() for c in (ov["categories"] or "").split(","))):
            if ov["verdict"] in counts[cat]:
                counts[cat][ov["verdict"]] += 1

    proposals = []
    for cat, c in sorted(counts.items()):
        total = c["confirm"] + c["overturn"]
        rate = c["overturn"] / total if total else 0.0
        entry = {"category": cat, "overrides": total,
                 "overturned": c["overturn"], "overturn_rate": round(rate, 3)}
        if total < MIN_OVERRIDES_PER_CATEGORY:
            entry["proposal"] = "no change (insufficient evidence)"
        elif rate >= OVERTURN_RATE_TRIGGER:
            per_pack = {}
            for name, lp in engine.all().items():
                cur = lp.pack.threshold(cat).flag
                new = round(min(cur + FLAG_DELTA, FLAG_CEILING), 3)
                if new != cur:
                    per_pack[name] = {"flag_current": cur, "flag_proposed": new}
            entry["proposal"] = f"raise flag threshold by {FLAG_DELTA} (reviewer-confirmed false positives)"
            entry["per_pack"] = per_pack
        else:
            entry["proposal"] = "no change (overturn rate below trigger)"
        proposals.append(entry)

    return {
        "generated_at": time.time(),
        "source": "quarantined feedback store (applied overrides only)",
        "policy": ("PROPOSALS ONLY - never auto-applied; apply via "
                   "/admin/operating-point or a signed pack edit"),
        "min_overrides_per_category": MIN_OVERRIDES_PER_CATEGORY,
        "overturn_rate_trigger": OVERTURN_RATE_TRIGGER,
        "categories": proposals,
    }


def main() -> None:
    proposal = build_proposal(FeedbackStore(), PolicyEngine())
    out = ROOT / "evals" / "out" / "retune_proposal.json"
    out.write_text(json.dumps(proposal, indent=1))
    print(f"wrote {out}")
    for p in proposal["categories"]:
        print(f"  {p['category']}: {p['overrides']} overrides, "
              f"overturn rate {p['overturn_rate']} -> {p['proposal']}")
    if not proposal["categories"]:
        print("  no applied overrides in the store - nothing to propose")


if __name__ == "__main__":
    main()

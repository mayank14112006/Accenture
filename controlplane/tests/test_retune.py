"""evals/retune.py: overrides produce proposals, empty store is a no-op,
and packs are never mutated — proposals only."""
import yaml

from controlplane.feedback import FeedbackStore
from controlplane.models import Override
from controlplane.policy import PolicyEngine
from evals.retune import MIN_OVERRIDES_PER_CATEGORY, build_proposal


def _engine(tmp_path):
    d = tmp_path / "policies"
    d.mkdir()
    (d / "p.yaml").write_text(yaml.safe_dump({
        "name": "p", "version": 1, "episode_budget_inr": 1000,
        "thresholds": {"grounding": {"flag": 0.5, "block": 0.85}}}),
        encoding="utf-8")
    return PolicyEngine(d), d / "p.yaml"


def test_overturned_overrides_produce_threshold_proposal(tmp_path):
    store = FeedbackStore(tmp_path / "f.sqlite3")
    for i in range(MIN_OVERRIDES_PER_CATEGORY):
        store.submit(Override(decision_id=f"d{i}", reviewer="asha",
                              verdict="overturn"), categories="grounding")
    eng, _ = _engine(tmp_path)
    proposal = build_proposal(store, eng)
    (entry,) = proposal["categories"]
    assert entry["category"] == "grounding"
    assert entry["overturn_rate"] == 1.0
    assert "raise flag threshold" in entry["proposal"]
    assert entry["per_pack"]["p"]["flag_proposed"] > entry["per_pack"]["p"]["flag_current"]


def test_empty_store_is_noop(tmp_path):
    store = FeedbackStore(tmp_path / "f.sqlite3")
    eng, _ = _engine(tmp_path)
    proposal = build_proposal(store, eng)
    assert proposal["categories"] == []


def test_retune_never_mutates_packs(tmp_path):
    store = FeedbackStore(tmp_path / "f.sqlite3")
    for i in range(MIN_OVERRIDES_PER_CATEGORY):
        store.submit(Override(decision_id=f"d{i}", reviewer="asha",
                              verdict="overturn"), categories="grounding")
    eng, pack_path = _engine(tmp_path)
    before = pack_path.read_bytes()
    build_proposal(store, eng)
    assert pack_path.read_bytes() == before
    assert eng.resolve("p").pack.threshold("grounding").flag == 0.5

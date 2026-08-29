"""Policy anti-rollback, ledger tamper evidence, override two-person rule,
fail-closed behaviour."""
import sqlite3

import pytest
import yaml

from controlplane.decision import decide
from controlplane.feedback import FeedbackStore
from controlplane.ledger import EvidenceLedger
from controlplane.models import DecisionType, Override
from controlplane.policy import PolicyEngine, PolicyPack, Thresholds


@pytest.fixture()
def tmp_policies(tmp_path):
    d = tmp_path / "policies"
    d.mkdir()
    (d / "p.yaml").write_text(yaml.safe_dump({
        "name": "p", "version": 3, "episode_budget_inr": 1000}), encoding="utf-8")
    return d


def test_policy_rollback_refused(tmp_policies):
    eng = PolicyEngine(tmp_policies)
    assert eng.resolve("p").pack.version == 3
    # replay an older, validly-formatted (hence 'validly signed') pack
    (tmp_policies / "p.yaml").write_text(yaml.safe_dump({
        "name": "p", "version": 2, "episode_budget_inr": 999999}), encoding="utf-8")
    errors = eng.reload()
    assert any("rollback refused" in e for e in errors)
    assert eng.resolve("p").pack.version == 3          # last-known-good still serves
    assert eng.resolve("p").pack.episode_budget_inr == 1000


def test_invalid_pack_keeps_last_known_good(tmp_policies):
    eng = PolicyEngine(tmp_policies)
    (tmp_policies / "p.yaml").write_text("::: not yaml :::{", encoding="utf-8")
    errors = eng.reload()
    assert errors
    assert eng.resolve("p").pack.version == 3


def test_unknown_use_case_gets_strictest_pack(tmp_policies):
    (tmp_policies / "loose.yaml").write_text(yaml.safe_dump({
        "name": "loose", "version": 1, "episode_budget_inr": 999999}), encoding="utf-8")
    eng = PolicyEngine(tmp_policies)
    assert eng.resolve("never_registered").pack.name == "p"  # smallest budget wins


def test_ledger_detects_tampering(tmp_path):
    led = EvidenceLedger(tmp_path / "l.sqlite3")
    for i in range(3):
        led._append("decision", {"i": i}, episode_id="e", raw_content=f"text {i}")
    assert led.verify()["chain_intact"]
    conn = sqlite3.connect(tmp_path / "l.sqlite3")
    conn.execute("UPDATE entries SET payload_json='{\"i\": 999}' WHERE seq=2")
    conn.commit()
    v = led.verify()
    assert not v["chain_intact"]
    assert v["broken"]


def test_high_severity_override_requires_second_approver(tmp_path):
    store = FeedbackStore(tmp_path / "f.sqlite3")
    ov = store.submit(Override(decision_id="d1", reviewer="asha",
                               verdict="overturn", severity="high"))
    assert ov.state == "pending_second_approval"
    same = store.approve_second(ov.id, "asha")
    assert "error" in same                              # self-approval refused
    ok = store.approve_second(ov.id, "vikram")
    assert ok["state"] == "applied"


def _pack(failure_mode):
    return PolicyPack(
        name="t", version=1, failure_mode=failure_mode,
        thresholds={c: Thresholds() for c in
                    ["grounding", "privacy", "toxicity", "injection", "cost"]})


def test_fail_closed_blocks_on_checker_fault():
    out = decide([], [], _pack("fail_closed"), "hello", None, False, False, faults=1)
    assert out.decision == DecisionType.BLOCK
    assert not out.deliver
    assert out.failure_mode_applied == "fail_closed"


def test_fail_open_delivers_annotated_on_checker_fault():
    out = decide([], [], _pack("fail_open"), "hello", None, False, False, faults=1)
    assert out.decision == DecisionType.PASS
    assert out.deliver
    assert out.failure_mode_applied == "fail_open"
    assert any("degraded" in a for a in out.annotations)

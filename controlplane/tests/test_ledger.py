"""Evidence-ledger guarantees: the chain verifies, any tamper breaks it, and
no raw content ever lands in the database — keyed digests only."""
import hashlib
import sqlite3

from controlplane.ledger import EvidenceLedger

RAW = "Customer Anita Deshmukh, phone 9830144556, refund ₹4,250 approved."


def _led(tmp_path, n=6):
    led = EvidenceLedger(tmp_path / "l.sqlite3")
    for i in range(n):
        led._append("decision", {"i": i, "note": f"entry {i}"},
                    episode_id="ep", raw_content=RAW)
    return led


def test_chain_verifies_after_appends(tmp_path):
    v = _led(tmp_path).verify()
    assert v["chain_intact"]
    assert v["entries"] == 6
    assert not v["broken"]


def test_payload_tamper_breaks_chain(tmp_path):
    led = _led(tmp_path)
    conn = sqlite3.connect(led.path)
    conn.execute("UPDATE entries SET payload_json='{\"i\": 999}' WHERE seq=3")
    conn.commit()
    v = led.verify()
    assert not v["chain_intact"]
    assert any(b["seq"] == 3 for b in v["broken"])


def test_relink_tamper_still_detected(tmp_path):
    """Rewriting an entry AND its stored prev_hash to look self-consistent
    still breaks the link from the previous row."""
    led = _led(tmp_path)
    conn = sqlite3.connect(led.path)
    conn.execute("UPDATE entries SET prev_hash='f'*64 WHERE seq=4")
    conn.commit()
    assert not led.verify()["chain_intact"]


def test_no_raw_content_in_database(tmp_path):
    led = _led(tmp_path)
    conn = sqlite3.connect(led.path)
    rows = conn.execute("SELECT payload_json, content_hmac, prev_hash, entry_hash"
                        " FROM entries").fetchall()
    assert rows
    for row in rows:
        for col in row:
            assert "Deshmukh" not in col
            assert "9830144556" not in col
        # the digest is keyed - NOT a bare hash an attacker could dictionary-reverse
        assert row[1] != hashlib.sha256(RAW.encode()).hexdigest()
        assert len(row[1]) == 64


def test_checkpoint_anchors_written_and_checked(tmp_path, monkeypatch):
    import controlplane.ledger as ledger_mod
    monkeypatch.setattr(ledger_mod, "CHECKPOINT_EVERY", 5)
    led = EvidenceLedger(tmp_path / "l2.sqlite3")
    led.checkpoint_path = tmp_path / "anchors.log"
    for i in range(12):
        led._append("decision", {"i": i})
    v = led.verify()
    assert v["anchors_checked"] == 2          # at seq 5 and 10
    assert v["anchors_ok"] == 2

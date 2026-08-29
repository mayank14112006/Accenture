"""Signature verification: a validly-signed pack loads when the key is set;
a tampered pack (content no longer matching its .sig) is refused and
last-known-good keeps serving."""
import hashlib
import hmac

import yaml

from controlplane.config import settings
from controlplane.policy import PolicyEngine, sign_pack_file

KEY = "test-signing-key"


def _write_pack(d, version, budget):
    (d / "p.yaml").write_text(yaml.safe_dump({
        "name": "p", "version": version, "episode_budget_inr": budget}),
        encoding="utf-8")


def _sign(path, key=KEY):
    sig = hmac.new(key.encode(), path.read_bytes(), hashlib.sha256).hexdigest()
    path.with_suffix(path.suffix + ".sig").write_text(sig)


def test_signed_pack_loads_when_key_set(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "policy_signing_key", KEY)
    d = tmp_path / "policies"
    d.mkdir()
    _write_pack(d, 1, 1000)
    _sign(d / "p.yaml")
    eng = PolicyEngine(d)
    lp = eng.resolve("p")
    assert lp.pack.version == 1
    assert lp.signed


def test_tampered_pack_refused_last_known_good_serves(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "policy_signing_key", KEY)
    d = tmp_path / "policies"
    d.mkdir()
    _write_pack(d, 1, 1000)
    _sign(d / "p.yaml")
    eng = PolicyEngine(d)
    assert eng.resolve("p").pack.episode_budget_inr == 1000
    # tamper: rewrite the pack without re-signing (stale .sig no longer matches)
    _write_pack(d, 2, 999999)
    errors = eng.reload()
    assert any("signature verification failed" in e for e in errors)
    assert eng.resolve("p").pack.episode_budget_inr == 1000


def test_missing_sig_refused_when_key_set(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "policy_signing_key", KEY)
    d = tmp_path / "policies"
    d.mkdir()
    _write_pack(d, 1, 1000)
    errors = PolicyEngine(d).reload()
    assert any("signature verification failed" in e for e in errors)


def test_sign_pack_file_matches_verifier(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "policy_signing_key", KEY)
    d = tmp_path / "policies"
    d.mkdir()
    _write_pack(d, 5, 2000)
    sign_pack_file(d / "p.yaml")          # the re-sign-on-write path
    eng = PolicyEngine(d)
    assert eng.resolve("p").pack.version == 5

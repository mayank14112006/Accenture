"""Sign policy packs: writes <pack>.yaml.sig (HMAC-SHA256 over the file bytes).

    CP_POLICY_SIGNING_KEY=... python -m scripts.sign_policies

When CP_POLICY_SIGNING_KEY is set on the gateway, packs without a valid .sig are
refused at load (last-known-good keeps serving). Key custody note: in the managed
service the signing key lives OUTSIDE the client tenancy; only the verification
path ships with the gateway.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import sys
from pathlib import Path

key = os.getenv("CP_POLICY_SIGNING_KEY", "")
if not key:
    sys.exit("set CP_POLICY_SIGNING_KEY first")

policies = Path(__file__).resolve().parent.parent / "policies"
targets = sorted(policies.glob("*.yaml")) + sorted((policies / "overlays").glob("*.yaml"))
for path in targets:
    sig = hmac.new(key.encode(), path.read_bytes(), hashlib.sha256).hexdigest()
    path.with_suffix(path.suffix + ".sig").write_text(sig)
    print(f"signed {path.name} -> {sig[:16]}…")

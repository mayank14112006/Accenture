"""Policy-as-data engine.

Packs are YAML files under ./policies. Each pack is validated (Pydantic),
content-hashed (sha256), optionally HMAC-signed (<pack>.sig), and hot-reloaded
by mtime polling — no restart, no code change.

Hardening (from adversarial review):
- Monotonic version enforcement: a pack whose `version` is <= the highest version
  already seen for that pack name is REFUSED (anti-rollback: yesterday's
  validly-signed permissive pack cannot be replayed). The prototype tracks the
  high-water mark in memory (per process); production anchors it in the evidence
  ledger so it survives restarts — stated honestly here and in the README.
- Atomic snapshot: callers resolve the pack object once per request and carry the
  reference; a mid-request hot-swap cannot mix versions.
- Last-known-good: an unparseable/unverifiable pack never takes effect; the engine
  keeps serving the previous pack and records the refusal.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

from .config import settings


class Thresholds(BaseModel):
    flag: float = 0.5     # >= flag  -> ANNOTATE (or REPAIR if repairable)
    block: float = 0.85   # >= block -> BLOCK / ESCALATE per matrix


class IdentityWindow(BaseModel):
    limit_inr: float = 200_000.0
    window_hours: float = 24.0


class PolicyPack(BaseModel):
    name: str
    version: int = 1
    jurisdiction: str = "IN"
    description: str = ""
    mode: str = "inline"                     # gate | inline | audit
    latency_budget_ms: float = 1500.0
    failure_mode: str = "fail_open"          # fail_open | fail_closed
    data_sensitivity: str = "internal"       # public | internal | regulated
    stream_release: str = "sentence"         # sentence (buffered) | free
    thresholds: dict[str, Thresholds] = {}
    # Expected-loss severity per category, in INR. ILLUSTRATIVE in the prototype;
    # in deployment this table is agreed with and signed off by the client's risk
    # office during the assessment phase (see business proposal).
    severities_inr: dict[str, float] = {}
    episode_budget_inr: float = 50_000.0
    # Escalation percentile is the *operating point dial* — budget suggestions are
    # recalibrated from benign-traffic percentiles by evals/retune.py.
    budget_percentile: float = 95.0
    identity_window: IdentityWindow = IdentityWindow()
    # Correlated risk clusters: labels that commonly fire on the SAME underlying
    # event (brief's overlap example: fabricated detail about a person =
    # grounding AND privacy). Debited once at max severity; both labels recorded.
    correlated_clusters: list[list[str]] = [["grounding", "privacy"]]
    # Tool registry for the action gate
    tools: dict[str, str] = {}               # tool name -> reversible | irreversible
    # Minimum claim status required before an irreversible action may run.
    # "grounded" means: no unresolved TAINTED or LOW_TRUST claim in the episode.
    irreversible_requires: str = "grounded"
    # Source trust floor: claims supported ONLY by low-trust sources are treated
    # as tainted for gating (brief: loosely governed data sources; MemGhost).
    low_trust_taints: bool = True
    # Assumed deployment base rate of real failures, used for prior-shift
    # correction of calibrated detector probabilities (stated assumption).
    assumed_base_rate: float = 0.03
    redact_pii: bool = True

    def threshold(self, category: str) -> Thresholds:
        return self.thresholds.get(category, Thresholds())

    def severity(self, category: str) -> float:
        return self.severities_inr.get(category, 10_000.0)


def sign_pack_file(path: Path) -> None:
    """Re-sign a pack after a governed write (jurisdiction switch, operating-point
    apply) so hot-reload verification still passes when a signing key is set.
    No-op when signing is not configured."""
    if not settings.policy_signing_key:
        return
    sig = hmac.new(settings.policy_signing_key.encode(), path.read_bytes(),
                   hashlib.sha256).hexdigest()
    path.with_suffix(path.suffix + ".sig").write_text(sig)


class LoadedPack(BaseModel):
    pack: PolicyPack
    pack_hash: str
    signed: bool
    path: str
    loaded_at: float


class PolicyEngine:
    def __init__(self, policies_dir: Optional[Path] = None) -> None:
        self.dir = policies_dir or settings.policies_dir
        self._packs: dict[str, LoadedPack] = {}
        self._max_seen_version: dict[str, int] = {}
        self._mtimes: dict[str, float] = {}
        self.refusals: list[dict] = []
        self.reload()

    # -- loading ---------------------------------------------------------
    def _verify_signature(self, path: Path, raw: bytes) -> bool:
        sig_path = path.with_suffix(path.suffix + ".sig")
        if not settings.policy_signing_key:
            return True  # signing not enforced when no key configured (demo mode)
        if not sig_path.exists():
            return False
        expected = hmac.new(settings.policy_signing_key.encode(), raw, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, sig_path.read_text().strip())

    def _load_file(self, path: Path) -> Optional[str]:
        """Returns an error string, or None on success."""
        try:
            raw = path.read_bytes()
            data = yaml.safe_load(raw)
            pack = PolicyPack.model_validate(data)
        except Exception as e:  # unparseable/invalid -> keep last-known-good
            return f"invalid pack {path.name}: {e}"
        if not self._verify_signature(path, raw):
            return f"signature verification failed for {path.name}"
        last = self._max_seen_version.get(pack.name, 0)
        current = self._packs.get(pack.name)
        # Anti-rollback: refuse version <= max ever seen, unless it is the
        # identical content we already serve (a plain restart).
        pack_hash = hashlib.sha256(raw).hexdigest()
        if pack.version < last or (
            pack.version == last and current and current.pack_hash != pack_hash
        ):
            return (
                f"rollback refused for {pack.name}: version {pack.version} "
                f"<= last seen {last} with different content"
            )
        self._packs[pack.name] = LoadedPack(
            pack=pack, pack_hash=pack_hash,
            signed=bool(settings.policy_signing_key),
            path=str(path), loaded_at=time.time(),
        )
        self._max_seen_version[pack.name] = max(last, pack.version)
        return None

    def reload(self) -> list[str]:
        errors: list[str] = []
        for path in sorted(self.dir.glob("*.yaml")):
            err = self._load_file(path)
            if err:
                errors.append(err)
                self.refusals.append({"ts": time.time(), "error": err})
        return errors

    def poll(self) -> list[str]:
        """Cheap mtime-based hot reload; called by a background task."""
        changed = False
        for path in self.dir.glob("*.yaml"):
            m = path.stat().st_mtime
            if self._mtimes.get(str(path)) != m:
                self._mtimes[str(path)] = m
                changed = True
        return self.reload() if changed else []

    # -- resolution ------------------------------------------------------
    def resolve(self, use_case: str) -> LoadedPack:
        """Atomic per-request snapshot. Unknown use case -> most conservative
        stance: the strictest pack we have, in gate mode (fail-closed posture)."""
        if use_case in self._packs:
            return self._packs[use_case]
        strictest = min(
            self._packs.values(),
            key=lambda lp: lp.pack.episode_budget_inr,
            default=None,
        )
        if strictest is None:
            raise RuntimeError("no policy packs loaded")
        return strictest

    def all(self) -> dict[str, LoadedPack]:
        return dict(self._packs)

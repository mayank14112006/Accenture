"""Runtime configuration (env-driven, everything defaults to fully-offline demo mode)."""
from __future__ import annotations

import os
import secrets
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        self.provider: str = os.getenv("CP_PROVIDER", "sim")
        self.openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if self.provider == "gemini":
            # Gemini via its OpenAI-compatible endpoint — same adapter, different
            # defaults. CP_PROVIDER=gemini + GEMINI_API_KEY is all that's needed.
            self.openai_base_url = os.getenv(
                "OPENAI_BASE_URL",
                "https://generativelanguage.googleapis.com/v1beta/openai")
            self.openai_api_key = (os.getenv("GEMINI_API_KEY")
                                   or os.getenv("OPENAI_API_KEY", ""))
            self.openai_model = os.getenv("OPENAI_MODEL", "gemini-2.5-flash")
        self.detector_profile: str = os.getenv("CP_DETECTOR_PROFILE", "lite")
        # Keyed hashing: PII is never stored plain nor as a bare (brute-forceable) hash.
        self.ledger_hmac_key: bytes = (
            os.getenv("CP_LEDGER_HMAC_KEY") or secrets.token_hex(16)
        ).encode()
        self.policy_signing_key: str = os.getenv("CP_POLICY_SIGNING_KEY", "")
        self.data_dir: Path = Path(os.getenv("CP_DATA_DIR", "./data"))
        self.policies_dir: Path = Path(os.getenv("CP_POLICIES_DIR", "./policies"))
        self.evals_out_dir: Path = Path(os.getenv("CP_EVALS_OUT", "./evals/out"))
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # Illustrative unit economics (stated assumptions, editable):
    # - blended model cost ₹0.04 per 1K tokens (≈ US$0.48/M blended, mid-tier API);
    # - Tier-0/1 assurance cost is METERED CPU TIME (detector wall-ms × a cloud
    #   vCPU rate of ₹2.5/hour ≈ US$0.03/hr) — not a flat per-pass fee;
    # - Tier-2 judge calls cost ₹0.05 each (small-model API call).
    # These feed the live "assurance as % of model spend" meter and are
    # labelled as assumptions in the UI.
    MODEL_COST_PER_1K_TOKENS_INR = 0.04
    CPU_RATE_INR_PER_HOUR = 2.5
    TIER2_JUDGE_COST_INR = 0.05


settings = Settings()

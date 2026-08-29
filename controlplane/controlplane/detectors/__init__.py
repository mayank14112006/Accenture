"""Detector registry."""
from __future__ import annotations

from ..config import settings
from .base import CheckContext, Detector
from .tier0 import TIER0
from .tier1 import load_tier1
from .tier2 import LlmJudge

_registry: list[Detector] | None = None


def all_detectors() -> list[Detector]:
    global _registry
    if _registry is None:
        _registry = [*TIER0, *load_tier1(settings.detector_profile), LlmJudge()]
    return _registry


__all__ = ["CheckContext", "Detector", "all_detectors"]

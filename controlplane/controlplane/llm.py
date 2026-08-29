"""Model providers behind one interface — the gateway is model-agnostic.

SimProvider (default): deterministic, fully offline. Two modes:
1. DIRECTED — the request body carries a `cp_sim` object dictating the exact
   output (and optional tool_call / logprobs). This is the replay/fixture
   mechanism: evals inject known failures with labels by construction, and the
   stage demo cannot be broken by venue Wi-Fi or model nondeterminism.
   Fixtures are keyed on the request, not the policy — replaying the same
   episode under a different jurisdiction pack shows different DECISIONS on
   identical content, which is exactly the policy-hot-swap demo.
2. SCENARIO — without a directive, a small scenario library pattern-matches
   the user message (interactive demo mode).

OpenAIProvider: any OpenAI-compatible endpoint via env config. Logprobs
availability is probed and recorded in the model fingerprint (the entropy
detector is opportunistic — never substituted with a proxy).
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any, AsyncIterator, Optional

import httpx

from .config import settings


class Completion:
    def __init__(self, text: str, tool_calls: Optional[list[dict]] = None,
                 logprobs: Optional[list[float]] = None,
                 tokens_in: int = 0, tokens_out: int = 0,
                 fingerprint: str = "") -> None:
        self.text = text
        self.tool_calls = tool_calls or []
        self.logprobs = logprobs
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out or max(1, len(text.split()))
        self.fingerprint = fingerprint


class BaseProvider:
    async def complete(self, messages: list[dict], cp_sim: Optional[dict] = None) -> Completion:
        raise NotImplementedError

    async def stream(self, messages: list[dict],
                     cp_sim: Optional[dict] = None) -> AsyncIterator[str]:
        raise NotImplementedError

    async def judge(self, rubric: str, sources: list[str], response: str) -> dict:
        raise NotImplementedError


# --------------------------------------------------------------------- sim
_SCENARIOS: list[tuple[str, re.Pattern, str]] = [
    ("support_refund", re.compile(r"refund|order", re.I),
     "Your refund request has been received. Refunds are processed within 5-7 "
     "business days once approved, and you will get a confirmation by email. "
     "Is there anything else I can help you with?"),
    ("copilot_policy", re.compile(r"leave policy|holiday|vacation", re.I),
     "According to the HR policy document, employees are entitled to 24 days of "
     "paid leave per year, and unused leave up to 10 days can be carried forward."),
    ("agent_generic", re.compile(r"claim|invoice|payment", re.I),
     "I have reviewed the case. Let me look up the relevant records to proceed."),
]

_FALLBACK = ("I can help with that. Could you share a little more detail about "
             "what you need?")


class SimProvider(BaseProvider):
    name = "sim"

    async def complete(self, messages: list[dict], cp_sim: Optional[dict] = None) -> Completion:
        user = _last_user(messages)
        tokens_in = sum(len(str(m.get("content", "")).split()) for m in messages)
        if cp_sim:  # directed / replay
            text = cp_sim.get("output", "")
            return Completion(
                text=text,
                tool_calls=cp_sim.get("tool_calls") or [],
                logprobs=cp_sim.get("logprobs"),
                tokens_in=tokens_in,
                fingerprint="sim/replay-fixture logprobs=directed")
        for _, rex, resp in _SCENARIOS:
            if rex.search(user):
                return Completion(text=resp, tokens_in=tokens_in,
                                  fingerprint="sim/scenario logprobs=no")
        return Completion(text=_FALLBACK, tokens_in=tokens_in,
                          fingerprint="sim/scenario logprobs=no")

    async def stream(self, messages: list[dict],
                     cp_sim: Optional[dict] = None) -> AsyncIterator[str]:
        comp = await self.complete(messages, cp_sim)
        for word in comp.text.split(" "):
            yield word + " "
            await asyncio.sleep(0.004)  # simulate generation pace

    async def judge(self, rubric: str, sources: list[str], response: str) -> dict:
        """Deterministic sim judge: lexical entailment over sources (labelled
        as sim in the fingerprint; swap CP_PROVIDER=openai for a live judge)."""
        from .canonical import extract_entities, numbers_match
        corpus = " ".join(sources)
        corpus_ents = extract_entities(corpus)
        unsupported = []
        for sent in re.split(r"(?<=[.!?])\s+", response):
            if len(sent.split()) < 4:
                continue
            for e in extract_entities(sent):
                if e.kind == "number":
                    if not any(h.kind == "number" and h.value is not None
                               and e.value is not None and numbers_match(h.value, e.value)
                               for h in corpus_ents):
                        unsupported.append(sent.strip())
                        break
                elif e.kind in ("date", "id", "name"):
                    if not any(h.canonical == e.canonical for h in corpus_ents):
                        unsupported.append(sent.strip())
                        break
        return {"unsupported_claims": unsupported[:5],
                "privacy_issue": False, "toxicity_issue": False,
                "confidence": 0.8 if sources else 0.3}


# --------------------------------------------------------------------- openai
class OpenAIProvider(BaseProvider):
    """Any OpenAI-compatible endpoint: OpenAI, Azure, Gemini (via its
    /v1beta/openai compatibility layer), Groq, Ollama, vLLM…"""

    name = "openai"

    def __init__(self) -> None:
        self.base = settings.openai_base_url.rstrip("/")
        self.key = settings.openai_api_key
        self.model = settings.openai_model
        self._logprobs_ok: bool | None = None  # probed on first call

    async def complete(self, messages: list[dict], cp_sim: Optional[dict] = None) -> Completion:
        body: dict = {"model": self.model, "messages": messages}
        if self._logprobs_ok is not False:
            body["logprobs"] = True
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.base}/chat/completions",
                headers={"Authorization": f"Bearer {self.key}"},
                json=body)
            if r.status_code == 400 and "logprobs" in body:
                # endpoint (e.g. Gemini compat layer) rejects the param —
                # retry without and remember; entropy detector is opportunistic
                self._logprobs_ok = False
                body.pop("logprobs")
                r = await client.post(
                    f"{self.base}/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json=body)
            r.raise_for_status()
            data = r.json()
        choice = data["choices"][0]
        lp = None
        try:
            lp = [t["logprob"] for t in choice["logprobs"]["content"]]
        except (KeyError, TypeError):
            pass
        usage = data.get("usage", {})
        return Completion(
            text=choice["message"].get("content") or "",
            tool_calls=choice["message"].get("tool_calls") or [],
            logprobs=lp,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            fingerprint=f"{settings.provider}/{self.model} logprobs={'yes' if lp else 'no'}")

    async def stream(self, messages: list[dict],
                     cp_sim: Optional[dict] = None) -> AsyncIterator[str]:
        comp = await self.complete(messages, cp_sim)  # simple non-SSE fallback
        for word in comp.text.split(" "):
            yield word + " "

    async def judge(self, rubric: str, sources: list[str], response: str) -> dict:
        msgs = [{"role": "system", "content": rubric},
                {"role": "user", "content":
                 "SOURCES:\n" + "\n---\n".join(sources) + f"\n\nRESPONSE:\n{response}"}]
        comp = await self.complete(msgs)
        try:
            return json.loads(re.search(r"\{.*\}", comp.text, re.S).group(0))
        except Exception:
            return {"unsupported_claims": [], "privacy_issue": False,
                    "toxicity_issue": False, "confidence": 0.0}


def _last_user(messages: list[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return str(m.get("content", ""))
    return ""


_provider: BaseProvider | None = None


def get_provider() -> BaseProvider:
    global _provider
    if _provider is None:
        _provider = (OpenAIProvider() if settings.provider in ("openai", "gemini")
                     else SimProvider())
    return _provider

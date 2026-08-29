"""Sentence-buffered streaming release: PII appearing mid-sentence must be
masked BEFORE the sentence crosses the wire — no unmasked digits in any chunk."""
import json
import uuid

from fastapi.testclient import TestClient

from controlplane.main import app

PHONE = "98301 44556"


def _stream(client, output_text):
    body = {
        "messages": [{"role": "user", "content": "What number do you have on file?"}],
        "cp_use_case": "customer_support",
        "cp_episode_id": f"stream-test-{uuid.uuid4().hex[:8]}",
        "cp_identity": f"stream-ident-{uuid.uuid4().hex[:8]}",
        "cp_sim": {"output": output_text},
        "stream": True,
    }
    chunks, meta = [], {}
    with client.stream("POST", "/v1/chat/completions", json=body) as r:
        assert r.status_code == 200
        for line in r.iter_lines():
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            payload = json.loads(line[6:])
            delta = payload["choices"][0]["delta"].get("content")
            if delta:
                chunks.append(delta)
            if "controlplane" in payload:
                meta = payload["controlplane"]
    return chunks, meta


def test_phone_number_mid_sentence_never_crosses_unmasked():
    with TestClient(app) as client:
        chunks, meta = _stream(
            client,
            f"We have your callback number +91 {PHONE} on file, and the refund "
            f"for order ORD-482913 was approved yesterday.")
    full = "".join(chunks)
    assert full, "stream delivered nothing"
    # neither the full number nor either half may appear in ANY released chunk
    for fragment in (PHONE, "98301", "44556"):
        assert fragment not in full
        assert all(fragment not in c for c in chunks)
    assert meta.get("decision") in ("REPAIR", "ANNOTATE", "PASS")


def test_clean_stream_arrives_intact():
    text = "Your refund for order ORD-482913 was approved yesterday."
    with TestClient(app) as client:
        chunks, _ = _stream(client, text)
    assert "".join(chunks).strip() == text

"""Hash-chained evidence ledger. (A hash chain — deliberately not a blockchain.)

Privacy: the ledger stores NO raw response text. Content is recorded as a keyed
HMAC-SHA256 digest — a bare hash of low-entropy PII (phone numbers ~10^10) is
trivially brute-forceable, so possession of the ledger alone reverses nothing
without the key. Raw (redacted) text lives only in the separate, quarantined
feedback store with its own retention policy (feedback.py).

Tamper evidence: each entry's hash covers the previous entry's hash. Because a
chain alone cannot survive an attacker with file access (rewrite + recompute),
the chain head is periodically anchored OUTSIDE the database: appended to
data/ledger_checkpoints.log every CHECKPOINT_EVERY entries. In production this
anchor is an RFC 3161 timestamp or object-lock storage; the mechanism is the
same. /admin/ledger/verify walks the chain and cross-checks anchors.

Concurrency: WAL mode + a single asyncio writer task. The chain needs strictly
serialized writes (each row reads prev_hash); the queue makes that correct by
construction and keeps the load test lock-free.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

from .config import settings

GENESIS = "0" * 64
CHECKPOINT_EVERY = 25


def content_digest(text: str) -> str:
    return hmac.new(settings.ledger_hmac_key, text.encode(), hashlib.sha256).hexdigest()


class EvidenceLedger:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or (settings.data_dir / "ledger.sqlite3")
        self.checkpoint_path = settings.data_dir / "ledger_checkpoints.log"
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL NOT NULL,
                kind TEXT NOT NULL,
                episode_id TEXT,
                decision_id TEXT,
                payload_json TEXT NOT NULL,     -- metadata only, never raw text
                content_hmac TEXT,              -- keyed digest of the raw content
                prev_hash TEXT NOT NULL,
                entry_hash TEXT NOT NULL
            )""")
        self._conn.commit()
        self._queue: asyncio.Queue | None = None
        self._task: asyncio.Task | None = None

    # -- single-writer machinery ------------------------------------------
    def start(self) -> None:
        self._queue = asyncio.Queue()
        self._task = asyncio.create_task(self._writer())

    async def stop(self) -> None:
        if self._queue is not None:
            await self._queue.put(None)
            if self._task:
                await self._task

    async def _writer(self) -> None:
        assert self._queue is not None
        while True:
            item = await self._queue.get()
            if item is None:
                return
            payload, fut = item
            try:
                h = self._append(**payload)
                fut.set_result(h)
            except Exception as e:  # pragma: no cover
                fut.set_exception(e)

    async def append(self, kind: str, payload: dict[str, Any],
                     episode_id: str = "", decision_id: str = "",
                     raw_content: str = "") -> str:
        """Queue an entry; resolves to the entry hash."""
        if self._queue is None:  # sync fallback (tests, eval harness)
            return self._append(kind, payload, episode_id, decision_id, raw_content)
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        await self._queue.put((dict(kind=kind, payload=payload, episode_id=episode_id,
                                    decision_id=decision_id, raw_content=raw_content), fut))
        return await fut

    # -- core append (serialized) ------------------------------------------
    def _append(self, kind: str, payload: dict[str, Any], episode_id: str = "",
                decision_id: str = "", raw_content: str = "") -> str:
        cur = self._conn.execute(
            "SELECT seq, entry_hash FROM entries ORDER BY seq DESC LIMIT 1")
        row = cur.fetchone()
        prev_seq, prev_hash = (row if row else (0, GENESIS))
        ts = time.time()
        digest = content_digest(raw_content) if raw_content else ""
        body = json.dumps(payload, sort_keys=True, default=str)
        entry_hash = hashlib.sha256(
            f"{prev_hash}|{ts:.6f}|{kind}|{episode_id}|{decision_id}|{digest}|{body}"
            .encode()).hexdigest()
        self._conn.execute(
            "INSERT INTO entries (ts, kind, episode_id, decision_id, payload_json,"
            " content_hmac, prev_hash, entry_hash) VALUES (?,?,?,?,?,?,?,?)",
            (ts, kind, episode_id, decision_id, body, digest, prev_hash, entry_hash))
        self._conn.commit()
        if (prev_seq + 1) % CHECKPOINT_EVERY == 0:
            self._anchor(prev_seq + 1, entry_hash)
        return entry_hash

    def _anchor(self, seq: int, head: str) -> None:
        with open(self.checkpoint_path, "a", encoding="utf-8") as f:
            f.write(f"{time.time():.3f} seq={seq} head={head}\n")

    # -- reads ---------------------------------------------------------------
    def entries(self, limit: int = 100, episode_id: str | None = None) -> list[dict]:
        q = "SELECT seq, ts, kind, episode_id, decision_id, payload_json, prev_hash, entry_hash FROM entries"
        args: tuple = ()
        if episode_id:
            q += " WHERE episode_id = ?"
            args = (episode_id,)
        q += " ORDER BY seq DESC LIMIT ?"
        rows = self._conn.execute(q, args + (limit,)).fetchall()
        return [dict(seq=r[0], ts=r[1], kind=r[2], episode_id=r[3], decision_id=r[4],
                     payload=json.loads(r[5]), prev_hash=r[6], entry_hash=r[7])
                for r in rows]

    def verify(self) -> dict:
        """Walk the whole chain; recompute nothing from raw content (we don't
        have it) — verify linkage integrity + checkpoint anchors."""
        rows = self._conn.execute(
            "SELECT seq, ts, kind, episode_id, decision_id, payload_json,"
            " content_hmac, prev_hash, entry_hash FROM entries ORDER BY seq").fetchall()
        prev = GENESIS
        broken = []
        for seq, ts, kind, ep, dec, body, digest, prev_hash, entry_hash in rows:
            if prev_hash != prev:
                broken.append({"seq": seq, "error": "prev_hash mismatch"})
            expect = hashlib.sha256(
                f"{prev_hash}|{ts:.6f}|{kind}|{ep}|{dec}|{digest}|{body}".encode()
            ).hexdigest()
            if expect != entry_hash:
                broken.append({"seq": seq, "error": "entry_hash mismatch"})
            prev = entry_hash
        anchors_ok, anchors_total = 0, 0
        if self.checkpoint_path.exists():
            by_seq = {r[0]: r[8] for r in rows}
            for line in self.checkpoint_path.read_text().splitlines():
                try:
                    parts = dict(p.split("=", 1) for p in line.split()[1:])
                    anchors_total += 1
                    if by_seq.get(int(parts["seq"])) == parts["head"]:
                        anchors_ok += 1
                except Exception:
                    continue
        return {"entries": len(rows), "chain_intact": not broken, "broken": broken[:5],
                "anchors_checked": anchors_total, "anchors_ok": anchors_ok}


ledger = EvidenceLedger()

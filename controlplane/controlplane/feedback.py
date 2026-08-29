"""Quarantined feedback store — deliberately SEPARATE from the evidence ledger.

Two stores, two policies (review finding E2): the evidence ledger holds keyed
hashes only; this store holds PII-REDACTED text needed to turn overrides into
labelled data, with an explicit retention period. Overrides here are the input
to evals/retune.py (thin, honest feedback loop: no online learning).

Override governance (A6): reviewer identity always recorded; HIGH-severity
overrides require a second approver before they take effect; the per-reviewer
override rate is a dashboard metric (rubber-stamp detection).
"""
from __future__ import annotations

import re
import sqlite3
import time
from pathlib import Path
from typing import Optional

from .config import settings
from .models import Override

RETENTION_DAYS = 30

_PII_SCRUB = [
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?<!\d)(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}(?!\d)"),
    re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    re.compile(r"(?<!\d)[2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4}(?!\d)"),
]


def redact(text: str) -> str:
    for rex in _PII_SCRUB:
        text = rex.sub("[REDACTED]", text)
    return text


class FeedbackStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or (settings.data_dir / "feedback.sqlite3")
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS overrides (
                id TEXT PRIMARY KEY, ts REAL, decision_id TEXT, reviewer TEXT,
                verdict TEXT, note TEXT, severity TEXT, second_approver TEXT,
                state TEXT, redacted_text TEXT, categories TEXT
            )""")
        self._conn.commit()

    def submit(self, ov: Override, decision_text: str = "", categories: str = "") -> Override:
        if ov.severity == "high" and not ov.second_approver:
            ov.state = "pending_second_approval"
        else:
            ov.state = "applied"
        self._conn.execute(
            "INSERT OR REPLACE INTO overrides VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (ov.id, ov.ts, ov.decision_id, ov.reviewer, ov.verdict, ov.note,
             ov.severity, ov.second_approver, ov.state,
             redact(decision_text)[:2000], categories))
        self._conn.commit()
        return ov

    def approve_second(self, override_id: str, approver: str) -> Optional[dict]:
        row = self._conn.execute(
            "SELECT reviewer, state FROM overrides WHERE id=?", (override_id,)).fetchone()
        if not row:
            return None
        reviewer, state = row
        if approver == reviewer:
            return {"error": "second approver must differ from the original reviewer"}
        self._conn.execute(
            "UPDATE overrides SET second_approver=?, state='applied' WHERE id=?",
            (approver, override_id))
        self._conn.commit()
        return {"id": override_id, "state": "applied", "second_approver": approver}

    def all(self, limit: int = 200) -> list[dict]:
        self.purge_expired()
        rows = self._conn.execute(
            "SELECT id, ts, decision_id, reviewer, verdict, note, severity,"
            " second_approver, state, categories FROM overrides"
            " ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        keys = ["id", "ts", "decision_id", "reviewer", "verdict", "note",
                "severity", "second_approver", "state", "categories"]
        return [dict(zip(keys, r)) for r in rows]

    def reviewer_rates(self) -> dict[str, dict]:
        rows = self._conn.execute(
            "SELECT reviewer, verdict, COUNT(*) FROM overrides GROUP BY reviewer, verdict"
        ).fetchall()
        out: dict[str, dict] = {}
        for reviewer, verdict, n in rows:
            out.setdefault(reviewer, {"confirm": 0, "overturn": 0})
            out[reviewer][verdict] = n
        for r, d in out.items():
            total = d["confirm"] + d["overturn"]
            d["overturn_rate"] = round(d["overturn"] / total, 3) if total else 0.0
        return out

    def purge_expired(self) -> int:
        cutoff = time.time() - RETENTION_DAYS * 86400
        cur = self._conn.execute("DELETE FROM overrides WHERE ts < ?", (cutoff,))
        self._conn.commit()
        return cur.rowcount


feedback = FeedbackStore()

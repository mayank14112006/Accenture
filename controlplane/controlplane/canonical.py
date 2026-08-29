"""Canonical value extraction.

Taint propagation on raw surface strings is defeated by any reformatting
("₹1,20,000" vs "120000" vs "one point two lakh"). Everything here therefore
parses values to CANONICAL forms before matching:

- numbers  -> float value (Indian digit grouping, lakh/crore words,
              number-words like "twelve thousand five hundred", currency
              symbols, percent)
- dates    -> ISO yyyy-mm-dd (several common formats)
- names    -> casefolded, honorific-stripped token sequence
- ids      -> uppercased alphanumeric (invoice/account/claim references)
- emails, phones -> normalized strings

Pure standard library. Deterministic. Milliseconds.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Entity:
    kind: str        # number | date | id | name | email | phone
    canonical: str   # e.g. "num:120000.0", "date:2026-03-04", "name:priya sharma"
    display: str     # surface form as it appeared
    start: int
    end: int

    @property
    def value(self) -> float | None:
        if self.kind == "number":
            raw = self.canonical.split(":", 1)[1]
            try:
                # percentage canonicals carry a trailing '%' ("num:15%") —
                # their numeric magnitude is still comparable
                return float(raw.rstrip("%"))
            except ValueError:
                return None
        return None


# ---------------------------------------------------------------- numbers
_NUM_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
    "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
_SCALES = {"hundred": 100, "thousand": 1_000, "lakh": 100_000, "lakhs": 100_000,
           "lac": 100_000, "crore": 10_000_000, "crores": 10_000_000,
           "million": 1_000_000, "billion": 1_000_000_000, "k": 1_000}

_WORDNUM_RE = re.compile(
    r"\b((?:(?:" + "|".join(_NUM_WORDS) + r")|point|and|[0-9]+(?:\.[0-9]+)?)"
    r"(?:[\s-]+(?:" + "|".join(list(_NUM_WORDS) + list(_SCALES)) + r"|point|and|[0-9]+(?:\.[0-9]+)?))+"
    r"|(?:[0-9]+(?:\.[0-9]+)?|" + "|".join(_NUM_WORDS) + r")[\s-]+(?:" + "|".join(_SCALES) + r"))\b",
    re.IGNORECASE,
)

_DIGIT_NUM_RE = re.compile(
    r"(?<![\w.])(?:₹|Rs\.?\s*|INR\s*|\$|USD\s*)?"
    r"([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)"
    r"\s*(%|lakh|lakhs|lac|crore|crores|k\b|million|billion)?",
    re.IGNORECASE,
)


def _parse_word_number(text: str) -> float | None:
    tokens = re.split(r"[\s-]+", text.lower())
    # digit-only sequences ("5-7 business days") are RANGES, not word numbers;
    # pure digits are handled by _DIGIT_NUM_RE
    if all(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", t) for t in tokens if t not in ("and", "point")):
        return None
    total, current, seen = 0.0, 0.0, False
    frac_mode, frac_digits = False, []
    for tok in tokens:
        if tok == "and":
            continue
        if tok == "point":
            frac_mode = True
            continue
        if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", tok):
            num: float = float(tok)
            if frac_mode:
                frac_digits.append(tok)
                continue
            current += num
            seen = True
        elif tok in _NUM_WORDS:
            if frac_mode:
                frac_digits.append(str(_NUM_WORDS[tok]))
                continue
            current += _NUM_WORDS[tok]
            seen = True
        elif tok in _SCALES:
            if frac_digits:  # "one point two lakh" -> 1.2 * scale
                current += float("0." + "".join(frac_digits))
                frac_digits, frac_mode = [], False
            current = (current or 1) * _SCALES[tok]
            if _SCALES[tok] >= 1000:
                total += current
                current = 0.0
            seen = True
        else:
            return None
    if frac_digits:
        current += float("0." + "".join(frac_digits))
    return (total + current) if seen else None


def _canon_num(v: float) -> str:
    return f"num:{v:.6g}"


# ---------------------------------------------------------------- dates
_MONTHS = {m.lower(): i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}
_MONTHS.update({m[:3].lower(): i for m, i in list(_MONTHS.items())})

_DATE_RES = [
    # 2026-03-04 / 2026/03/04
    (re.compile(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    # 04-03-2026 / 04/03/2026  (day-first, Indian convention)
    (re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b"), lambda m: (int(m[3]), int(m[2]), int(m[1]))),
    # 4 March 2026 / 4th March, 2026
    (re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})\b"),
     lambda m: (int(m[3]), _MONTHS.get(m[2].lower(), 0), int(m[1]))),
    # March 4, 2026
    (re.compile(r"\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b"),
     lambda m: (int(m[3]), _MONTHS.get(m[1].lower(), 0), int(m[2]))),
]

# ---------------------------------------------------------------- ids / contact
_ID_RE = re.compile(r"\b(?:[A-Z]{2,5}[-/]?\d{4,12}|\d{4,6}[-/]\d{3,8}|[A-Z]{3}\d{7})\b")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}(?!\d)")

# ---------------------------------------------------------------- names
_HONORIFICS = {"mr", "mrs", "ms", "dr", "shri", "smt", "prof", "miss", "mx"}
_NAME_RE = re.compile(
    r"\b(?:(?:Mr|Mrs|Ms|Dr|Shri|Smt|Prof|Miss|Mx)\.?\s+)?"
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b"
)
# Common sentence-start words that masquerade as names
_NAME_STOPWORDS = {
    "the", "this", "that", "these", "those", "your", "our", "their", "there",
    "please", "thank", "based", "according", "however", "additionally",
}


def _canon_name(s: str) -> str:
    toks = [t for t in re.split(r"\s+", s.strip().lower().rstrip(".")) if t not in _HONORIFICS]
    return "name:" + " ".join(toks)


def extract_entities(text: str) -> list[Entity]:
    """Extract all canonical values from a piece of text."""
    out: list[Entity] = []
    taken: list[tuple[int, int]] = []

    def _claim(start: int, end: int) -> bool:
        for s, e in taken:
            if start < e and end > s:
                return False
        taken.append((start, end))
        return True

    for m in _EMAIL_RE.finditer(text):
        if _claim(*m.span()):
            out.append(Entity("email", "email:" + m.group(0).lower(), m.group(0), *m.span()))
    for m in _PHONE_RE.finditer(text):
        if _claim(*m.span()):
            digits = re.sub(r"\D", "", m.group(0))[-10:]
            out.append(Entity("phone", "phone:" + digits, m.group(0), *m.span()))
    for rex, parse in _DATE_RES:
        for m in rex.finditer(text):
            y, mo, d = parse(m)
            if 1 <= mo <= 12 and 1 <= d <= 31 and _claim(*m.span()):
                out.append(Entity("date", f"date:{y:04d}-{mo:02d}-{d:02d}", m.group(0), *m.span()))
    for m in _ID_RE.finditer(text):
        if _claim(*m.span()):
            out.append(Entity("id", "id:" + re.sub(r"[-/\s]", "", m.group(0)).upper(),
                              m.group(0), *m.span()))
    for m in _WORDNUM_RE.finditer(text):
        v = _parse_word_number(m.group(1))
        if v is not None and v >= 10 and _claim(*m.span()):
            out.append(Entity("number", _canon_num(v), m.group(0), *m.span()))
    for m in _DIGIT_NUM_RE.finditer(text):
        if not _claim(m.start(1), m.end(0)):
            continue
        v = float(m.group(1).replace(",", ""))
        unit = (m.group(2) or "").lower()
        if unit in _SCALES:
            v *= _SCALES[unit]
        if unit == "%":
            out.append(Entity("number", f"num:{v:.6g}%", m.group(0).strip(), m.start(), m.end()))
            continue
        if v < 10:  # ignore tiny ordinals/counts — noise, not claims
            continue
        out.append(Entity("number", _canon_num(v), m.group(0).strip(), m.start(), m.end()))
    for m in _NAME_RE.finditer(text):
        first = m.group(1).split()[0].lower()
        if first in _NAME_STOPWORDS:
            continue
        if _claim(*m.span(1)):
            out.append(Entity("name", _canon_name(m.group(1)), m.group(1), *m.span(1)))
    out.sort(key=lambda e: e.start)
    return out


def numbers_match(a: float, b: float, rel_tol: float = 0.005) -> bool:
    """Tolerance matching: rounding survives canonicalization."""
    if a == b:
        return True
    denom = max(abs(a), abs(b))
    return denom > 0 and abs(a - b) / denom <= rel_tol


def derivable(target: float, grounded: list[float], rel_tol: float = 0.005) -> str | None:
    """Whitelisted derivations: a value computable from grounded numbers is
    DERIVED, not tainted (sum, difference, product, ratio, percentage,
    simple scaling). Returns a human-readable formula or None.
    Capped to pairwise combinations for determinism and speed."""
    g = sorted(set(x for x in grounded if x is not None))[:24]
    for a in g:
        if numbers_match(target, a, rel_tol):
            return f"= {a:g}"
        # Percentage derivations model tax/discount arithmetic on AMOUNTS.
        # Small counts (leave days, item quantities) must not be whitelisted
        # as "24 + 25%" — a fabricated 30 is not a discount on a true 24.
        if a < 100:
            continue
        for pct in (0.05, 0.10, 0.12, 0.18, 0.25, 0.50):  # common tax/discount rates
            if numbers_match(target, a * (1 + pct), rel_tol):
                return f"{a:g} + {pct:.0%}"
            if numbers_match(target, a * (1 - pct), rel_tol):
                return f"{a:g} - {pct:.0%}"
    for i, a in enumerate(g):
        for b in g[i:]:
            if numbers_match(target, a + b, rel_tol):
                return f"{a:g} + {b:g}"
            if numbers_match(target, abs(a - b), rel_tol):
                return f"|{a:g} - {b:g}|"
            if b and numbers_match(target, a * b, rel_tol) and min(a, b) < 1000:
                return f"{a:g} x {b:g}"
            if b and numbers_match(target, a / b, rel_tol):
                return f"{a:g} / {b:g}"
    return None

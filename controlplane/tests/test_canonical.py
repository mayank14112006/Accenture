"""Canonicalization: the answer to 'what if the agent writes the number in words?'"""
from controlplane.canonical import derivable, extract_entities, numbers_match


def _nums(text):
    return [e.value for e in extract_entities(text) if e.kind == "number"]


def test_digit_formats_normalize():
    assert 120000.0 in _nums("the amount is ₹1,20,000 exactly")   # Indian grouping
    assert 120000.0 in _nums("the amount is 120000")
    assert 120000.0 in _nums("Rs. 1.2 lakh")
    assert 4500000.0 in _nums("45 lakh rupees")
    assert 20000000.0 in _nums("2 crore")


def test_word_numbers_normalize():
    assert 85000.0 in _nums("eighty-five thousand rupees")
    assert 120000.0 in _nums("one point two lakh")
    assert 12500.0 in _nums("twelve thousand five hundred")


def test_same_value_matches_across_forms():
    a = _nums("₹85,000")[0]
    b = _nums("eighty-five thousand")[0]
    assert numbers_match(a, b)


def test_rounding_tolerance():
    assert numbers_match(84999.0, 85000.0)
    assert not numbers_match(45000.0, 85000.0)


def test_dates_normalize_across_formats():
    forms = ["2026-03-04", "04/03/2026", "4 March 2026", "March 4, 2026", "4th March, 2026"]
    canons = set()
    for f in forms:
        ents = [e for e in extract_entities(f) if e.kind == "date"]
        assert ents, f
        canons.add(ents[0].canonical)
    assert canons == {"date:2026-03-04"}


def test_names_strip_honorifics():
    e1 = [e for e in extract_entities("Dr. Priya Sharma called") if e.kind == "name"][0]
    e2 = [e for e in extract_entities("priya sharma" .title()) if e.kind == "name"][0]
    assert e1.canonical == e2.canonical == "name:priya sharma"


def test_derivation_whitelist():
    grounded = [45000.0, 5000.0]
    assert derivable(50000.0, grounded)            # sum
    assert derivable(40000.0, grounded)            # difference
    assert derivable(45000.0 * 1.18, grounded)     # +18% GST
    assert derivable(85000.0, grounded) is None    # a fabrication is NOT derivable

"""Unit tests for the AD 2.13 declared-distances parser, using REAL section
text captured live (crawler-live-test `ad2_recon`, 19.07.2026) from LVNL (NL,
clean) and NATS/Aurora (UK, token-polluted)."""

from crawlers.declared_distances import parse_declared_distances

# --- NL / LVNL: clean numeric table ------------------------------------------

# EHAL Ameland - a small grass field, one clean row per runway.
NL_EHAL = (
    "DECLARED DISTANCES RWY designator TORA (M) TODA (M) ASDA (M) LDA (M) "
    "Remarks 1 2 3 4 5 6 08 860 860 860 860 NIL 26 860 860 860 860 NIL EHAL"
)

# EHBD Weert/Budel - displaced thresholds + two all-NIL grass strips (dropped).
NL_EHBD = (
    "DECLARED DISTANCES RWY designator TORA (M) TODA (M) ASDA (M) LDA (M) "
    "Remarks 1 2 3 4 5 6 03 1064 1124 1199 1149 DTHR 50 M. 21 1149 1199 1199 "
    "1064 DTHR 135 M. 03G NIL NIL NIL NIL NIL 21G NIL NIL NIL NIL NIL EHBD"
)


def test_nl_clean_simple():
    assert parse_declared_distances(NL_EHAL) == {
        "08": {"tora": 860, "toda": 860, "asda": 860, "lda": 860},
        "26": {"tora": 860, "toda": 860, "asda": 860, "lda": 860},
    }


def test_nl_dthr_and_all_nil_dropped():
    got = parse_declared_distances(NL_EHBD)
    # The displaced-threshold remark numbers ("DTHR 50 M") must NOT leak in.
    assert got["03"] == {"tora": 1064, "toda": 1124, "asda": 1199, "lda": 1149}
    assert got["21"] == {"tora": 1149, "toda": 1199, "asda": 1199, "lda": 1064}
    # The two all-NIL grass strips are dropped entirely.
    assert "03G" not in got and "21G" not in got


def test_nl_first_row_wins_over_intersections():
    # EHAM-style: a landing-only primary row, then intersection take-off rows
    # repeating the designator - the first row per designator wins.
    eham = (
        "DECLARED DISTANCES RWY designator TORA (M) TODA (M) ASDA (M) LDA (M) "
        "Remarks 1 2 3 4 5 6 04 NIL NIL NIL 2020 NIL 04 1909 1969 1909 NIL "
        "Take-off from intersection with TWY: G5 27 3453 3513 3453 3453 NIL"
    )
    got = parse_declared_distances(eham)
    assert got["04"] == {"lda": 2020}  # only LDA declared full-length
    assert got["27"] == {"tora": 3453, "toda": 3513, "asda": 3453, "lda": 3453}


# --- UK / NATS: token-polluted -----------------------------------------------

# EGPD Aberdeen RWY 16/34 - values interleaved with the eAIP data-attr tokens.
UK_EGPD = (
    "DECLARED DISTANCES Runway designator TORA TODA ASDA LDA Remarks 1 2 3 4 5 "
    "6 16 TRWY_DIRECTION;TXT_DESIG;484 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19071 M 2152 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19070 M 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19069 M 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19072 M Declared TORA commences at "
    "location of threshold lights. "
    "TRWY_DIRECTION_DECL_DIST;ANNOTATION:86737.eng;19071 34 "
    "TRWY_DIRECTION;TXT_DESIG;483 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19083 M 2091 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19082 M 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19081 M 1953 "
    "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19084 M"
)


def test_uk_token_polluted():
    got = parse_declared_distances(UK_EGPD)
    assert got["16"] == {"tora": 1953, "toda": 2152, "asda": 1953, "lda": 1953}
    assert got["34"] == {"tora": 1953, "toda": 2091, "asda": 1953, "lda": 1953}


# --- fail-soft ---------------------------------------------------------------


def test_empty_and_garbage():
    assert parse_declared_distances("") == {}
    assert parse_declared_distances("no declared distances section here") == {}

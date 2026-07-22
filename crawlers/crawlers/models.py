from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ChartLink(BaseModel):
    """One chart PDF as the source lists it: its own designation + URL.

    Elements are collected by ``HttpCrawlerBase._to_chart_links`` and stored
    on ``Airport.charts``; the website renders them as the collapsed
    "all charts" list under the primary chart link.
    """

    # Human-readable chart designation - the source's own link text, or the
    # PDF filename stem when the source links a bare icon (see _to_chart_links).
    name: str
    # Absolute URL of the chart PDF.
    url: str


class Airport(BaseModel):
    """One aerodrome / heliport row as posted to the website's /api/airports.

    Produced by every country crawler and serialized to the JSON the API
    validates with Zod. The field set mirrors the D1 `airports` table.
    """

    # ISO country code (upper-cased), e.g. "DE" - the API deletes+reinserts
    # per country, so this partitions the dataset.
    country: str
    # ICAO location indicator (4 letters), or None for small fields that the
    # source lists by name only. The website slug/breadcrumb falls back to the
    # slugified title when this is None.
    icao: str | None
    # Display name of the aerodrome (usually "<name> <ICAO>", see the parsers).
    title: str
    # Link the site opens for this field - the chart page, frameset, or (when
    # the source exposes one directly) the chart PDF itself.
    url: str
    # Direct link to the exact approach-chart PDF, where the source exposes a
    # stable one (chart-PDF plan Stage 2, docs/chart-pdf-plan.md). Optional:
    # crawlers that only know an index/frameset page leave it None and the
    # website falls back to `url`.
    pdf_url: str | None = None
    # FULL list of the chart PDFs the source page links for this airport
    # (capped in attach_pdf_urls). Feeds the website's "all charts" list;
    # pdf_url stays the primary pick for the main chart link.
    charts: list[ChartLink] | None = None
    # Category driving which search page the field appears on. Aliased to
    # "type" so the JSON/API key is `type` (the field name can't be `type`,
    # a Python builtin); FR uses `aeroport`/`mil`, others vfr/ifr/heliport.
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(
        alias="type"
    )

    # --- Light, non-rejecting normalizers -----------------------------------
    # These only clean the value; they never raise, because a validation error
    # here would abort the whole country in main.py's per-crawler try/except.
    # Structural problems (a wrong-length ICAO, a title that doesn't end in the
    # ICAO) are flagged - not dropped - by crawlers/sanitize.py at publish time.

    @field_validator("icao", mode="before")
    @classmethod
    def _normalize_icao(cls, v: object) -> str | None:
        """Upper-case + strip the ICAO; coerce empty/whitespace to None so a
        blank source cell never becomes a bogus code (the slug then falls back
        to the title). A malformed length is left as-is for sanitize to flag."""
        if v is None:
            return None
        s = str(v).strip().upper()
        return s or None

    @field_validator("country", mode="before")
    @classmethod
    def _normalize_country(cls, v: object) -> object:
        """Upper-case + strip the 2-letter country code (the API partitions on
        it, so a stray-cased value would fragment a country's dataset)."""
        return str(v).strip().upper() if v is not None else v

    @field_validator("title", "url", mode="before")
    @classmethod
    def _strip_str(cls, v: object) -> object:
        """Trim surrounding whitespace on the free-text string fields."""
        return v.strip() if isinstance(v, str) else v

from typing import Literal

from pydantic import BaseModel, Field


class ChartLink(BaseModel):
    """One chart PDF as the source lists it: its own designation + URL."""

    name: str
    url: str


class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
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
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(
        alias="type"
    )

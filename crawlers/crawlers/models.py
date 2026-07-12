from typing import Literal

from pydantic import BaseModel, Field


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
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(
        alias="type"
    )

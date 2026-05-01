from typing import Literal

from pydantic import BaseModel, Field


class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(
        alias="type"
    )

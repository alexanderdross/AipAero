"""Romania (ROMATSA / AISRO) AIP crawler.

Source: the Romanian AIS (AISRO, part of ROMATSA) publishes an open AIP whose
landing page `www.aisro.ro/aip/aip.php` links the currently effective edition
as `/aip/<YYYY-MM-DD>/index.html`. Each edition is a static, self-contained
tree; the aerodromes live under a browsable directory:

    /aip/<edition>/DOCS/AIP/AD/AD2/AD_2_<n>_<ICAO>/LR_AD_2_<ICAO>_en.pdf

(the Greece / BHANSA pattern - a static per-edition tree). The landing page
403s datacenter IPs but the deep static paths serve 200 from the runner, so no
proxy/JS is needed. This crawler resolves the effective edition by date, lists
the AD2 directory to enumerate every aerodrome dynamically (so a new AIRAC that
adds a field is picked up automatically), and points each field's url / pdf_url
at its combined AD 2 chart PDF. Names come from a static AD 1.3-derived map
(the directory carries ICAO codes only); an unknown ICAO falls back to the bare
code (the website enriches town/name from OurAirports/OpenAIP). LR is the
Romania ICAO prefix; all fields are "vfr".
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.http_eurocontrol_base import ad23_hours
from crawlers.models import ChartLink

COUNTRY = "RO"
LANDING_URL = "https://www.aisro.ro/aip/aip.php"

# The landing links each edition as `/aip/<YYYY-MM-DD>/index.html`; capture the
# date to pick the currently effective edition.
_EDITION_RE = re.compile(r"/aip/(\d{4})-(\d{2})-(\d{2})/index\.html", re.I)
# AD 2 directory entries are folders `AD_2_<n>_<ICAO>/`; capture the ICAO.
_AD2_FOLDER_RE = re.compile(r"AD_2_\d+_([A-Z]{4})/?$")

# Aerodrome names by ICAO (AD 1.3 "Index to aerodromes and heliports"; the AD2
# directory carries only ICAO codes). Fail-soft: an ICAO absent here keeps the
# bare code as its title and the website fills the town from OurAirports/OpenAIP.
_NAMES: dict[str, str] = {
    # International / IFR aerodromes (AD 1.3-1).
    "LRAR": "Arad",
    "LRBC": "Bacau / George Enescu",
    "LRBM": "Baia Mare / Maramures",
    "LRBS": "Bucuresti / Baneasa - Aurel Vlaicu",
    "LROP": "Bucuresti / Henri Coanda",
    "LRCS": "Caransebes / Banat",
    "LRCL": "Cluj-Napoca / Avram Iancu",
    "LRCK": "Constanta / Mihail Kogalniceanu",
    "LRCV": "Craiova",
    "LRIA": "Iasi",
    "LROD": "Oradea",
    "LRSM": "Satu Mare",
    "LRSB": "Sibiu",
    "LRSV": "Suceava / Stefan cel Mare",
    "LRTM": "Targu Mures / Transilvania",
    "LRTR": "Timisoara / Traian Vuia",
    # Smaller VFR aerodromes (AD 1.3-2/-3).
    "LRTC": "Tulcea / Delta Dunarii",
    "LRCD": "Cisnadie / Magura",
    "LRPW": "Ploiesti / Gheorghe Valentin Bibescu",
    "LRTZ": "Tuzla",
    "LRSP": "Brasov / Sanpetru",
    "LRPT": "Pitesti / Geamana",
    "LRDV": "Deva / Saulesti",
    "LRCB": "Arad / Siria (Charlie-Bravo)",
    "LRBN": "Bistrita",
    "LRBA": "Gradistea",
    "LRCN": "Clinceni",
    "LRBV": "Brasov / Ghimbav",
    "LRCJ": "Dezmir",
    "LRHR": "Gheorgheni / Remetea",
    "LRCW": "Craiova-Sud",
    "LRIS": "Iasi-Sud",
    "LRMS": "Targu Mures / Muraseni",
    "LRCR": "Brasov / Corona",
    "LRZN": "Piatra Neamt / Zanesti",
}


class RO(HttpCrawlerBase):
    """Romania (AISRO) AIP crawler - static per-edition DOCS tree.

    Resolves the effective edition off the landing page, lists the AD2
    directory to enumerate every aerodrome, and points each field at its
    combined AD 2 chart PDF.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # aisro.ro is UA/IP sensitive (it 403s datacenter IPs and serves a
        # gate page to plain UAs, so the edition link is absent); send a full
        # browser fingerprint like the other header-gated sources (BE/GR/SK).
        self.use_browser_headers()

    def _resolve_edition(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the effective edition date folder (e.g. "2026-07-09").

        Picks the latest edition on/before ``today`` (earliest if all are in
        the future), read from the `/aip/<date>/index.html` links.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)
        dates: set[datetime.date] = set()
        for a in soup.find_all("a", href=True):
            # The landing links the edition with a RELATIVE href
            # ("2026-07-09/index.html"); resolve to absolute before matching.
            m = _EDITION_RE.search(urljoin(LANDING_URL, a["href"]))
            if not m:
                continue
            try:
                dates.add(datetime.date(*(int(g) for g in m.groups())))
            except ValueError:
                continue
        if not dates:
            raise ValueError(
                f"RO: no /aip/<date>/index.html edition link on {LANDING_URL}"
            )
        in_effect = [d for d in dates if d <= today]
        eff = max(in_effect) if in_effect else min(dates)
        self.logger.info(f"RO current edition: {eff.isoformat()}")
        return eff.isoformat()

    def _crawl_ad2(self, ad2_dir_url: str) -> list[Airport]:
        """List the AD2 directory and build one "vfr" field per aerodrome."""
        listing = self.fetch(ad2_dir_url)
        soup = self.soup(listing)
        airports: list[Airport] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            m = _AD2_FOLDER_RE.search(a["href"].rstrip("/") + "/")
            if not m:
                continue
            icao = m.group(1).upper()
            if icao in seen:
                continue
            seen.add(icao)
            folder = urljoin(ad2_dir_url, a["href"].rstrip("/") + "/")
            pdf = urljoin(folder, f"LR_AD_2_{icao}_en.pdf")
            # The bare-ICAO PDF is the full AD-2 text sheet (not a graphic-only
            # chart); its AD 2.3 OPERATIONAL HOURS section drives operation
            # hours. One extra direct (unmetered) PDF fetch per field; fail-soft.
            try:
                hrs = ad23_hours(self.pdf_text(pdf))
                if hrs:
                    self.hours_by_icao[icao] = hrs
            except Exception as e:
                self.logger.debug(f"RO: {icao} AD 2.3 hours failed: {e}")
            name = _NAMES.get(icao, "")
            title = f"{name} {icao}".strip() if name else icao
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=pdf,
                    pdf_url=pdf,
                    charts=[
                        ChartLink(name=f"AD 2 {icao} - Aerodrome chart", url=pdf)
                    ],
                    type="vfr",
                )
            )
        if not airports:
            hrefs = [a["href"][:60] for a in soup.find_all("a", href=True)][:40]
            raise ValueError(
                f"RO: no AD_2_<n>_<ICAO> folders in {ad2_dir_url}. Hrefs: {hrefs}"
            )
        return airports

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url, last_html = LANDING_URL, None

        try:
            landing = self.fetch(LANDING_URL)
            last_html = landing
            edition = self._resolve_edition(landing)
            ad2_dir = (
                f"https://www.aisro.ro/aip/{edition}/DOCS/AIP/AD/AD2/"
            )
            last_url = ad2_dir
            airports = self._crawl_ad2(ad2_dir)
        except Exception as e:
            self.logger.error(f"RO crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

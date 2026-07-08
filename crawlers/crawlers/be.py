from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "BE"
ROOT_URL = (
    "https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/"
    "index-en-GB.html"
)

# skeyes splits Part 3 AERODROMES (AD) into several category sub-sections
# rather than a single "AD 2" / "AD 3" menu node. Per the task spec
# (crawlers/tasks/crawler_belgium_luxembourg.md) the categories map to our
# airport types as follows:
#
#   AD 2 PUBLIC AERODROMES    -> ifr
#   AD 2 MILITARY AERODROMES  -> mil
#   AD 2 PRIVATE AERODROMES   -> vfr
#   AD 2 ULM AERODROMES       -> vfr
#   AD 2 PERSONAL AERODROMES  -> vfr
#   AD 3 MILITARY HELIPORTS   -> heliport
#   AD 3 HOSPITAL HELIPORTS   -> heliport
#   AD 3 PRIVATE HELIPORTS    -> heliport
#   AD 3 PERSONAL HELIPORTS   -> heliport
#
# Each tuple is (list-of-candidate menu-div id suffixes, airport type). The
# base extractor matches any element whose id *ends with* one of the
# suffixes; we try each candidate in turn. The exact id strings used by the
# skeyes IDS-generated eAIP could not be verified against the live source
# from this environment (AIP hosts are unreachable here), so the suffixes
# below are best-effort — modelled on the eurocontrol "AD 2en-GBdetails"
# convention plus the category label. TODO: verify/adjust these suffixes
# against the live skeyes navigation HTML.
_SECTIONS: list[tuple[list[str], str]] = [
    (["AD 2 PUBLIC AERODROMESen-GBdetails", "AD 2 PUBLIC AERODROMESdetails"], "ifr"),
    (["AD 2 MILITARY AERODROMESen-GBdetails", "AD 2 MILITARY AERODROMESdetails"], "mil"),
    (["AD 2 PRIVATE AERODROMESen-GBdetails", "AD 2 PRIVATE AERODROMESdetails"], "vfr"),
    (["AD 2 ULM AERODROMESen-GBdetails", "AD 2 ULM AERODROMESdetails"], "vfr"),
    (["AD 2 PERSONAL AERODROMESen-GBdetails", "AD 2 PERSONAL AERODROMESdetails"], "vfr"),
    (["AD 3 MILITARY HELIPORTSen-GBdetails", "AD 3 MILITARY HELIPORTSdetails"], "heliport"),
    (["AD 3 HOSPITAL HELIPORTSen-GBdetails", "AD 3 HOSPITAL HELIPORTSdetails"], "heliport"),
    (["AD 3 PRIVATE HELIPORTSen-GBdetails", "AD 3 PRIVATE HELIPORTSdetails"], "heliport"),
    (["AD 3 PERSONAL HELIPORTSen-GBdetails", "AD 3 PERSONAL HELIPORTSdetails"], "heliport"),
]


class BE(HttpEurocontrolBase):
    """Belgium & Luxembourg AIP crawler.

    skeyes serves the standard eurocontrol frameset eAIP. `index-en-GB.html`
    is the edition entry point itself (no separate landing page listing dated
    AIRAC editions), so we walk the frame chain straight from ROOT_URL to the
    navigation HTML and parse each aerodrome/heliport category — no JS/browser
    needed.

        index-en-GB.html
            └─ frameset
                └─ frame name=eAISNavigationBase
                    └─ frame name=eAISNavigation  ← the menu we parse

    The AD category → airport type mapping (PUBLIC→ifr, MILITARY aerodromes→
    mil, PRIVATE/ULM/PERSONAL→vfr, all heliport categories→heliport) follows
    crawlers/tasks/crawler_belgium_luxembourg.md. The per-section menu-div id
    suffixes in `_SECTIONS` are best-effort and need live verification against
    the skeyes eAIP (see the module comment).
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # The source sits behind a WAF that 403s non-browser user
        # agents (verified in the live-crawl test run) - send a plain
        # browser fingerprint instead of the polite crawler UA.
        self.use_browser_headers()

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract one category, trying each candidate id suffix in turn.

        Belgium's eAIP has many small, optional category sub-sections; a
        missing one (empty for this cycle, or an unmatched id suffix) is
        logged and skipped rather than failing the whole crawl.
        """
        for menu_id in id_candidates:
            try:
                return self.extract_airports_from_html(
                    nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                )
            except ValueError:
                continue
        self.logger.warning(
            f"No {category!r} section matched any of {id_candidates!r} — skipping"
        )
        return []

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # Walk the frame chain from the edition index to the nav HTML.
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # Extract each AD category with its mapped airport type.
            for id_candidates, category in _SECTIONS:
                airports.extend(
                    self._extract_section(nav_html, nav_url, id_candidates, category)
                )
        except Exception as e:
            self.logger.error(f"BE crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

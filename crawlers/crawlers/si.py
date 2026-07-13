import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "SI"
# Slovenia Control serves a classic eurocontrol eAIP, but the host sends
# the WRONG RapidSSL intermediate (crawlers/recon/probe-si.md): the
# pinned public DigiCert intermediate below completes the chain -
# verification stays fully enabled (use_extra_ca, never verify=False).
# The AMDT history page is the edition picker (probe run 29271294861).
ROOT_URL = "https://aim.sloveniacontrol.si/aim/eAIP/Operations/history-en-GB.html"
CA_PEM_URL = "https://cacerts.digicert.com/RapidSSLTLSRSACAG1.crt.pem"

# Edition entry links on the history page ("index-en-GB.html" per AMDT);
# an embedded yyyy-mm-dd in the href picks the edition by date (NL/UK
# pattern) when present, else the first listed entry wins (newest first).
_INDEX_HREF_RE = re.compile(r"index-en-GB\.html?$", re.I)
_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
# Per-airport chapter fallback (CZ/PT/HU/IS layouts).
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2\.([A-Z]{4}).*details$")

_FRAME_CHAINS = (
    ["eAISNavigationBase", "eAISNavigation"],
    ["eAISNavigation"],
)


class SI(HttpEurocontrolBase):
    """Slovenia AIP crawler (Slovenia Control eAIP, task spec:
    europe-expansion.md).

    TLS needs the pinned RapidSSL intermediate (broken server chain).
    The AMDT history page links each edition's ``index-en-GB.html``;
    the frameset chain and AD-2 section layout are resolved from
    candidate lists with the base's diagnostics on a miss. Aerodromes
    are "vfr" (new-country convention), heliports fail-soft.
    """

    def __init__(self) -> None:
        # No network in __init__ (same rule as the lazy Playwright import):
        # the CA fetch happens at the start of crawl(), so importing /
        # instantiating SI never needs egress (CI import smoke test).
        super().__init__(COUNTRY)

    def _resolve_edition_entry(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        today = today or datetime.date.today()
        soup = self.soup(html)
        dated: list[tuple[datetime.date, str]] = []
        undated: list[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not _INDEX_HREF_RE.search(href):
                continue
            url = urljoin(ROOT_URL, href)
            m = _DATE_RE.search(href)
            if m:
                try:
                    dated.append(
                        (datetime.date(*(int(g) for g in m.groups())), url)
                    )
                    continue
                except ValueError:
                    pass
            undated.append(url)
        if dated:
            in_effect = [c for c in dated if c[0] <= today]
            effective, url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(f"SI edition (effective {effective}): {url}")
            return url
        if undated:
            self.logger.info(f"SI edition (first listed): {undated[0]}")
            return undated[0]
        # Diagnostics: show what the history page actually links.
        hrefs = [a["href"][:120] for a in soup.find_all("a", href=True)][:40]
        raise ValueError(
            f"No index-en-GB.html edition links in {ROOT_URL}. Hrefs: {hrefs}"
        )

    def _enter_nav(self, entry: str) -> tuple[str, str]:
        last_error: Exception | None = None
        for chain in _FRAME_CHAINS:
            try:
                return self.follow_frame_chain(entry, chain)
            except Exception as e:
                last_error = e
        assert last_error is not None
        raise last_error

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            self.use_extra_ca(CA_PEM_URL)
            history = self.fetch(ROOT_URL)
            last_html = history
            entry = self._resolve_edition_entry(history)

            nav_url, nav_html = self._enter_nav(entry)
            last_url, last_html = nav_url, nav_html

            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD2_SECTION_IDS, "vfr"
                    )
                )
            except ValueError as e:
                self.logger.warning(
                    f"SI: aggregate AD 2 parse failed ({e}); "
                    "trying per-airport chapters"
                )
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, nav_url, _AD2_CHAPTER_RE, "vfr"
                    )
                )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("SI: no AD 3 heliport section - skipping")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"SI crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract a menu section, trying each candidate id format in turn."""
        last_error: Exception | None = None
        for menu_id in id_candidates:
            try:
                return self.extract_airports_from_html(
                    nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                )
            except ValueError as e:
                last_error = e
        assert last_error is not None
        raise last_error

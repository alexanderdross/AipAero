import datetime
import re
from typing import Literal, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "AT"
# Austro Control's eAIP root; the current-edition table lives at this URL.
ROOT_URL = "https://eaip.austrocontrol.at"

# The root page tabulates the current edition plus a few upcoming ones. Each
# edition links to `./lo/YYMMDD/index.htm`, where YYMMDD is the AIRAC
# effective date; the effective row is flagged `<tr class="current">`, the
# others `<tr class="future">`. We only ever treat `…/YYMMDD/index.htm`
# hrefs as editions, so the "Additional products and services" links on the
# same page can never be mistaken for one.
_EDITION_HREF_RE = re.compile(r"(\d{2})(\d{2})(\d{2})/index", re.I)


class AT(HttpCrawlerBase):
    """Austria AIP crawler.

    Austrocontrol's eAIP is plain ISO-8859-1 encoded HTML - no frames,
    no JS (unlike the eurocontrol frameset crawlers). Navigate through
    three index pages (current version -> Part III/AD -> AD 2/AD 3) and
    parse a simple table of <td><a>ICAO</a></td> rows on each leaf. Being
    frameless, it inherits the plain HttpCrawlerBase rather than the
    eurocontrol base.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def fetch_iso(self, url: str) -> str:
        """Fetch a page decoded as ISO-8859-1 (the eAIP's declared charset).

        The pages are Latin-1, not UTF-8, so decoding them any other way
        mangles the Austrian umlauts in aerodrome/city names.
        """
        return self.fetch(url, encoding="iso-8859-1")

    @staticmethod
    def find_link_by_text(soup: BeautifulSoup, text: str) -> Optional[str]:
        """Return the href of the first link whose visible text contains ``text``.

        Matches on the anchor's full ``get_text()`` (not its direct
        ``.string``), so links wrapping nested markup - e.g.
        ``<a><b>Part III - AD</b></a>`` - still match, and normalises runs of
        whitespace on both sides so a stray double space in the markup can't
        defeat the lookup.
        """
        needle = " ".join(text.split())
        for a in soup.find_all("a", href=True):
            haystack = " ".join(a.get_text().split())
            if needle in haystack:
                return a.get("href")
        return None

    def _find_current_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Resolve the currently effective edition entry point on the root page.

        Selection order, most robust first:
          1. the edition link inside the ``<tr class="current">`` row - the
             site's own semantic marker for the effective cycle;
          2. the link whose text reads "…current version" / "aktuelle
             Ausgabe" (older / label-driven layouts);
          3. the latest edition whose date (the ``YYMMDD`` in the href) is on
             or before ``today``, falling back to the earliest listed edition
             if (unexpectedly) every edition is still in the future.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        # Return the first `…/YYMMDD/index.htm` edition href inside a scope
        # (a table row or the whole page), ignoring non-edition links.
        def edition_href(scope) -> str | None:
            for a in scope.find_all("a", href=True):
                if _EDITION_HREF_RE.search(a["href"]):
                    return a["href"]
            return None

        # 1. Semantic marker: the row flagged as the current cycle.
        for tr in soup.find_all("tr", class_="current"):
            href = edition_href(tr)
            if href:
                self.logger.info(f"Current AT edition (class='current'): {href}")
                return urljoin(base_url, href)

        # 2. Label text on the edition link itself.
        for a in soup.find_all("a", href=True):
            if not _EDITION_HREF_RE.search(a["href"]):
                continue
            text = " ".join(a.get_text().split()).casefold()
            if "current version" in text or "aktuelle ausgabe" in text:
                self.logger.info(f"Current AT edition (label): {a['href']}")
                return urljoin(base_url, a["href"])

        # 3. Date embedded in the edition href (YYMMDD). Parse every edition
        # link into (effective date, absolute url); skip impossible dates.
        dated: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _EDITION_HREF_RE.search(a["href"])
            if not m:
                continue
            yy, mm, dd = (int(g) for g in m.groups())
            try:
                effective = datetime.date(2000 + yy, mm, dd)
            except ValueError:
                continue
            dated.append((effective, urljoin(base_url, a["href"])))

        if dated:
            # Prefer the newest edition already in effect; if every edition is
            # still in the future, fall back to the earliest listed one.
            in_effect = [c for c in dated if c[0] <= today]
            effective_date, url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(
                f"Current AT edition (effective {effective_date.isoformat()}): "
                f"{url}"
            )
            return url

        raise ValueError(f"No current-edition link found in {base_url}")

    def extract_airports(
        self, url: str, airport_type: Literal["vfr", "ifr", "heliport"]
    ) -> list[Airport]:
        """Parse an AD 2 / AD 3 leaf table into Airport rows.

        Each aerodrome sits in a `<tr>` whose first cell links the ICAO code
        and second cell holds the city/name; the linked href points at that
        field's eAIP page. Rows with fewer than two cells or no first-cell
        link are skipped (spacers/headers).
        """
        text = self.fetch_iso(url)
        soup = self.soup(text)
        airports: list[Airport] = []

        for row in soup.find_all("tr"):
            # Need at least an ICAO cell and a city cell.
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            # The ICAO cell may contain several anchors; the first carries the
            # code text, the last carries the real destination href.
            first_links = cells[0].find_all("a")
            if not first_links:
                continue

            icao = first_links[0].get_text(strip=True)
            city = cells[1].get_text(strip=True)
            href = first_links[-1].get("href")

            if not href or icao == "AD 3":
                # "AD 3" is a section header row, not an aerodrome.
                continue

            full_url = urljoin(url, href)
            # title = "<city> <ICAO>"; icao normalised to None when blank so
            # the site can slugify the title instead.
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao or None,
                    title=f"{city} {icao}",
                    url=full_url,
                    type=airport_type,
                )
            )
        return airports

    # Chart-PDF extraction (recon 2026-07-12): the AD-2 page links every
    # chart as "LOWG AD 2 MAP 1-1" etc.; MAP 1-1 is the aerodrome chart.
    FETCH_PDF_URLS = True
    # Prefer the aerodrome chart (MAP 1-1) among the AD-2 chart links.
    PDF_TEXT_PRIORITY = (r"AD 2 MAP 1-1$",)

    def crawl(self) -> list[Airport]:
        """Drive the three-hop navigation and return all AT airports.

        Root -> effective edition -> Part III (AD) -> AD 2 (aerodromes,
        "vfr") + AD 3 (heliports). On any failure the last page fetched is
        dumped via `save_response` for post-mortem before re-raising.
        """
        self.logger.info(f"Crawling airports in {self.country}")
        last_url = ROOT_URL
        last_html: str | None = None
        try:
            # 1. Root → currently effective edition (class='current' / date).
            root_html = self.fetch_iso(ROOT_URL)
            last_url, last_html = ROOT_URL, root_html

            main_aip_url = self._find_current_edition_url(ROOT_URL, root_html)

            # 2. Current version → "Part III - AD".
            main_html = self.fetch_iso(main_aip_url)
            last_url, last_html = main_aip_url, main_html

            href = self.find_link_by_text(self.soup(main_html), "Part III - AD")
            if not href:
                raise ValueError(
                    f"'Part III - AD' link not found in {main_aip_url}"
                )
            ad_url = urljoin(main_aip_url, href)

            # 3. AD index → AD 2 (aerodromes) and AD 3 (heliports).
            ad_html = self.fetch_iso(ad_url)
            last_url, last_html = ad_url, ad_html
            ad_soup = self.soup(ad_html)

            href_airports = self.find_link_by_text(ad_soup, "AD 2")
            href_heliports = self.find_link_by_text(ad_soup, "AD 3")
            if not href_airports or not href_heliports:
                raise ValueError(
                    f"'AD 2' or 'AD 3' link not found in {ad_url}"
                )

            airports = self.extract_airports(
                urljoin(ad_url, href_airports), "vfr"
            )
            airports.extend(
                self.extract_airports(
                    urljoin(ad_url, href_heliports), "heliport"
                )
            )

            if not airports:
                raise ValueError(f"No {COUNTRY} airports found")

            self.logger.info(f"Found {len(airports)} airports for {COUNTRY}")
            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
            return airports
        except Exception as e:
            self.logger.error(f"AT crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

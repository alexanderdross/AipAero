import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "NL"
ROOT_URL = "https://eaip.lvnl.nl/web/eaip/default.html"

# The effective-edition entry document. IDS eAIPs name it either the bare
# `index.html` or a locale-suffixed variant (`index-en-GB.html`,
# `index-nl-NL.html`) — LVNL suffixes everything with `-en-GB`, so the bare
# match used previously never fired. Match both, anchored to the href tail.
_EDITION_HREF_RE = re.compile(r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I)
# Fallbacks for a default.html that redirects instead of linking.
_META_REFRESH_URL_RE = re.compile(r"url=([^;]+)", re.I)
_JS_LOCATION_RE = re.compile(r"""location(?:\.href)?\s*=\s*['"]([^'"]+)['"]""", re.I)


class NL(HttpEurocontrolBase):
    """Netherlands AIP crawler.

    LVNL's eAIP is a static eurocontrol-style frameset:

        default.html
            └─ <a href="…/index.html">  (current effective edition)
                └─ frameset
                    └─ frame name=eAISNavigationBase
                        └─ frame name=eAISNavigation  ← the menu we parse

    No JS execution is needed — every step resolves to a plain HTML doc.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_url(self, base_url: str, html: str) -> str:
        """Find the current effective edition entry point in default.html.

        Tries, in order:
          1. an `<a>` whose href tail looks like an eAIP edition index
             (`index.html` or a locale-suffixed `index-en-GB.html`);
          2. a `<meta http-equiv="refresh" content="…;url=…">` redirect;
          3. a `location = "…"` / `location.href = "…"` JS redirect.

        Selenium used to follow (2)/(3) transparently; httpx does not, so we
        recover the target from the markup instead.
        """
        soup = self.soup(html)

        for a in soup.find_all("a", href=True):
            href_tail = a["href"].split("?")[0].split("#")[0]
            if _EDITION_HREF_RE.search(href_tail):
                return urljoin(base_url, a["href"])

        meta = soup.find(
            "meta", attrs={"http-equiv": re.compile("refresh", re.I)}
        )
        if meta and meta.get("content"):
            m = _META_REFRESH_URL_RE.search(meta["content"])
            if m:
                return urljoin(base_url, m.group(1).strip().strip("'\""))

        m = _JS_LOCATION_RE.search(html)
        if m:
            return urljoin(base_url, m.group(1))

        raise ValueError(
            f"Could not resolve current-edition link/redirect in {base_url}"
        )

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the link to the current effective edition.
            default_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, default_html

            edition_url = self._resolve_edition_url(ROOT_URL, default_html)
            self.logger.info(f"Current edition: {edition_url}")

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2) and heliports (AD 3).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                )
            )
        except Exception as e:
            self.logger.error(f"NL crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

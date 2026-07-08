import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "SE"
# BEST-EFFORT / UNVERIFIED: LFV's ARO eAIP portal. There is no task spec for
# Sweden, so both this entry point and the frame/section ids below are a
# plausible guess modelled on the EUROCONTROL-style eAIP other Nordic states
# publish. Validate against the live site before scheduling this crawler.
ROOT_URL = "https://aro.lfv.se/Editorial/View/IAIP?folderId=19"

# LFV, like LVNL/NATS, is expected to expose dated AIRAC editions whose links
# embed the effective date `YYYY_MM_DD` right before the index file. We pick
# the latest edition already in effect on today's date (same strategy as the
# NL/UK crawlers). Windows-style backslash separators are normalised to "/".
_EDITION_DATE_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})[\\/]index[^\\/]*\.html", re.I)
# Fallbacks for a single-edition layout that links / redirects to a bare or
# locale-suffixed index instead of dated editions.
_EDITION_HREF_RE = re.compile(r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I)
_META_REFRESH_URL_RE = re.compile(r"url=([^;]+)", re.I)
_JS_LOCATION_RE = re.compile(r"""location(?:\.href)?\s*=\s*['"]([^'"]+)['"]""", re.I)


class SE(HttpEurocontrolBase):
    """Sweden AIP crawler — BEST-EFFORT, UNVERIFIED (no task spec).

    There is no crawler task spec for Sweden. This module is written on the
    assumption that LFV's ARO eAIP is a static EUROCONTROL-style frameset,
    modelled on the Netherlands (``nl.py``) crawler:

        ROOT_URL
            └─ pick edition by effective date (latest on/before today)
                └─ <edition>/index.html
                    └─ frameset
                        └─ frame name=eAISNavigationBase
                            └─ frame name=eAISNavigation  ← the menu we parse

    UNVERIFIED, must be validated against the live site before use:
      * ``ROOT_URL`` — the real ARO eAIP entry point / index page.
      * the frame chain names (``eAISNavigationBase`` / ``eAISNavigation``).
      * the AD section id suffixes passed to ``extract_airports_from_html``.
        These follow the eurocontrol convention (``AD 2…details`` for
        aerodromes → vfr, ``AD 3…details`` for heliports → heliport) but the
        exact locale-suffixed id string is a guess and may differ (e.g.
        ``AD 2en-GBdetails`` vs. ``AD 2sv-SEdetails``).

    No JS execution is intended — every step should resolve to a plain HTML
    document. If LFV requires JS rendering, a Playwright fallback is needed.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Find the current effective edition entry point in the index page.

        Primary path: read the effective date embedded in each dated edition
        link and return the latest edition already in effect on ``today``
        (falling back to the earliest listed edition if every edition is still
        in the future). Backslash separators are normalised to "/".

        Fallbacks for a single-edition layout: the first bare / locale-suffixed
        ``index*.html`` link, then a ``<meta refresh>`` redirect, then a
        ``location = "…"`` JS redirect.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        dated: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _EDITION_DATE_RE.search(a["href"])
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                continue
            href = a["href"].replace("\\", "/")
            dated.append((effective, urljoin(base_url, href)))

        if dated:
            in_effect = [c for c in dated if c[0] <= today]
            effective_date, edition_url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(
                f"Current AIRAC edition (effective {effective_date.isoformat()}): "
                f"{edition_url}"
            )
            return edition_url

        # --- fallbacks: single-edition / redirect layouts --------------------
        for a in soup.find_all("a", href=True):
            href = a["href"].replace("\\", "/")
            if _EDITION_HREF_RE.search(href.split("?")[0].split("#")[0]):
                return urljoin(base_url, href)

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

        # No edition list found - the page may already be the frameset.
        self.logger.info(
            f"SE: no edition link in {base_url}; treating it as the frameset"
        )
        return base_url

    def _find_eaip_entry(self, base_url: str, html: str) -> str | None:
        """Find the /content/eaip/... entry link on the AROWeb portal page."""
        import re as _re
        from urllib.parse import urljoin as _urljoin

        rx = _re.compile(r"content/eaip/.*\.html", _re.I)
        soup = self.soup(html)
        for a in soup.find_all("a", href=True):
            if rx.search(a["href"]):
                return _urljoin(base_url, a["href"])
        return None

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the currently effective edition (by AIRAC date).
            index_resp = self.fetch_response(ROOT_URL)
            index_url = str(index_resp.url)
            index_html = index_resp.text
            last_url, last_html = index_url, index_html

            # AROWeb links the actual eAIP at /content/eaip/... (link text
            # "EAIP", verified via live-crawl diagnostics) - hop there before
            # resolving the edition.
            eaip_url = self._find_eaip_entry(index_url, index_html)
            if eaip_url:
                self.logger.info(f"SE eAIP entry: {eaip_url}")
                index_html = self.fetch(eaip_url)
                index_url = eaip_url
                last_url, last_html = index_url, index_html

            edition_url = self._resolve_edition_url(index_url, index_html)

            # Prefetch the edition page so a frame failure logs ITS links /
            # body (index-v2.html is a new LFV viewer - structure unknown).
            edition_html = self.fetch(edition_url)
            last_url, last_html = edition_url, edition_html

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2 → vfr) and heliports (AD 3 → heliport).
            #    Section id suffixes are UNVERIFIED — see class docstring.
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
            self.logger.error(f"SE crawl failed: {e}")
            if last_html is not None:
                self.log_candidate_links(last_html, last_url, limit=40)
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

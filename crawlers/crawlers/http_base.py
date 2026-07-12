import datetime
import html as html_module
import logging
import re
import time
from pathlib import Path
from urllib.parse import unquote, urljoin

import httpx
from bs4 import BeautifulSoup

from crawlers.models import Airport, ChartLink

__all__ = ["Airport", "HttpCrawlerBase"]

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "aip-aero-crawler/1.0 (+https://aip.aero)"
)

# Some national AIS providers front their eAIP with a WAF that 403s anything
# not looking like a real browser (skeyes/BE, HASP/GR). Crawlers for those
# sources call `use_browser_headers()` to send a plain browser fingerprint.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
BROWSER_HEADERS = {
    "User-Agent": BROWSER_USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}

# Retry on transient errors only. 4xx (except 429) are caller bugs and
# shouldn't be retried; 5xx and connection-level failures are.
_RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})

# The crawlers parse HTML navigation pages only - images, PDFs, fonts,
# scripts etc. are never needed. This guard keeps any future caller from
# fetching them by accident, which matters especially when traffic is
# routed through a metered proxy (Bright Data bills per GB).
_BINARY_URL_RE = re.compile(
    r"\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|pdf|zip|gz|7z|rar"
    r"|css|js|mjs|woff2?|ttf|otf|eot|mp4|webm|mp3|ogg)([?#]|$)",
    re.I,
)
_BINARY_CONTENT_TYPE_RE = re.compile(
    r"^(image/|font/|video/|audio/"
    r"|application/(pdf|zip|gzip|x-7z-compressed|octet-stream|font-\w+))",
    re.I,
)


class HttpCrawlerBase:
    """Base for crawlers that talk to AIP sites over plain HTTP.

    No browser, no WebDriver. Use this for any source that serves static
    HTML — including the eurocontrol-style frameset eAIPs, which are just
    chains of `<frame src="...">` references that resolve to plain pages.
    """

    timeout = httpx.Timeout(30.0, connect=10.0)
    max_retries = 3
    retry_initial_delay = 1.0  # seconds; doubles each attempt

    def __init__(self, country: str):
        self.country = country.upper()
        self.logger = logging.getLogger(__name__)
        self.client = httpx.Client(
            follow_redirects=True,
            timeout=self.timeout,
            headers={"User-Agent": DEFAULT_USER_AGENT},
            http2=False,
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def close(self) -> None:
        try:
            self.client.close()
        except Exception:
            pass

    def use_browser_headers(self) -> None:
        """Switch the client to a browser-like fingerprint (WAF'd sources)."""
        self.client.headers.update(BROWSER_HEADERS)

    def use_proxy(self, proxy_url: str) -> None:
        """Route this crawler's traffic through an HTTP(S) proxy.

        Used for sources whose WAF blocks datacenter IPs outright (GR). The
        proxy URL (e.g. a Bright Data zone,
        ``http://user:pass@brd.superproxy.io:22225``) comes from the
        environment - never hardcode credentials. TLS verification is
        disabled because unblocker-style proxies re-encrypt with their own
        CA; the crawled data is public AIP HTML, so integrity risk is nil.

        Proxy traffic stays minimal by construction: there is no browser,
        so nothing is ever fetched beyond the explicitly requested
        navigation pages, and ``fetch_response`` additionally refuses
        image/binary URLs and content types (metered proxies bill per GB).
        """
        # Tolerate copy-paste artefacts in the env value: surrounding
        # whitespace/quotes and a missing scheme (httpx requires one;
        # Bright Data's dashboard shows the credentials without it).
        proxy_url = proxy_url.strip().strip("'\"")
        if "://" not in proxy_url:
            self.logger.warning(
                f"{self.country}: proxy URL has no scheme; assuming http://"
            )
            proxy_url = f"http://{proxy_url}"
        headers = dict(self.client.headers)
        self.client.close()
        self.client = httpx.Client(
            follow_redirects=True,
            timeout=self.timeout,
            headers=headers,
            http2=False,
            proxy=proxy_url,
            verify=False,
        )
        # Log without credentials.
        safe = proxy_url.split("@")[-1]
        self.logger.info(f"{self.country}: routing via proxy {safe}")

    def log_candidate_links(
        self,
        html: str,
        base_url: str,
        limit: int = 30,
        contains: str | None = None,
    ) -> None:
        """Log the page's links so a failed live run shows what IS there.

        Diagnostic aid for the crawler-live-test workflow: when navigation
        fails (unknown page layout, changed structure), the job log then
        carries the real hrefs/texts needed to fix the parser - no need to
        download the saved-response artifact.
        """
        try:
            soup = self.soup(html)
            rx = re.compile(contains, re.I) if contains else None
            links = [
                f"{(a.get_text(strip=True) or '')[:60]!r} -> {a['href'][:120]}"
                for a in soup.find_all("a", href=True)
                if rx is None
                or rx.search(a["href"])
                or rx.search(a.get_text(" ", strip=True) or "")
            ]
            self.logger.warning(
                f"{self.country}: {len(links)} links on {base_url}; "
                f"first {min(limit, len(links))}:"
            )
            for line in links[:limit]:
                self.logger.warning(f"  {line}")
            if not links:
                self.logger.warning(
                    f"{self.country}: page has NO links - likely a "
                    "JS-rendered app; body starts: "
                    f"{html[:300]!r}"
                )
        except Exception as e:
            self.logger.warning(f"link diagnostics failed: {e}")

    def fetch(self, url: str, *, encoding: str | None = None) -> str:
        """Fetch a URL and return the decoded body (see fetch_response)."""
        response = self.fetch_response(url)
        if encoding is not None:
            response.encoding = encoding
        return response.text

    def fetch_response(self, url: str) -> httpx.Response:
        """Fetch a URL and return the httpx Response (redirects followed).

        Callers that need the FINAL post-redirect URL (e.g. to resolve
        relative links on a redirected landing page) use this and read
        ``str(response.url)``; `fetch()` wraps it for body-only callers.

        Retries up to ``max_retries`` times on connection errors and on
        retryable 5xx / 429 responses, with exponential backoff. Other 4xx
        responses propagate immediately — those are typically caller bugs,
        not transient.

        HTML only: URLs with an image/binary extension are refused before
        any request is made, and responses with an image/binary
        Content-Type are rejected after the fact - the crawlers never need
        anything but navigation HTML, and this keeps metered proxy traffic
        (Bright Data) down to those small text documents.
        """
        if _BINARY_URL_RE.search(url):
            raise ValueError(
                f"Refusing to fetch non-HTML resource {url} - the crawler "
                "fetches HTML navigation pages only"
            )
        self.logger.debug(f"GET {url}")
        delay = self.retry_initial_delay
        last_exc: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.client.get(url)
            except httpx.TransportError as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"GET {url} transport error ({exc!s}); "
                        f"retry {attempt}/{self.max_retries - 1} in {delay:.1f}s"
                    )
                    time.sleep(delay)
                    delay *= 2
                continue

            if response.status_code in _RETRYABLE_STATUSES:
                last_exc = httpx.HTTPStatusError(
                    f"retryable status {response.status_code}",
                    request=response.request,
                    response=response,
                )
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"GET {url} -> {response.status_code}; "
                        f"retry {attempt}/{self.max_retries - 1} in {delay:.1f}s"
                    )
                    time.sleep(delay)
                    delay *= 2
                continue

            # 2xx success or non-retryable 4xx/3xx — bail out of the loop.
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if _BINARY_CONTENT_TYPE_RE.match(content_type.strip()):
                raise ValueError(
                    f"{url} returned non-HTML content type "
                    f"{content_type!r} - the crawler fetches HTML "
                    "navigation pages only"
                )
            return response

        # Exhausted all retries.
        assert last_exc is not None
        raise last_exc

    def soup(self, html: str, *, parser: str = "html.parser") -> BeautifulSoup:
        return BeautifulSoup(html, parser)

    def get_frame_src(self, html: str, base_url: str, frame_name: str) -> str:
        """Resolve the `src` attribute of a `<frame>` / `<iframe>` by name."""
        soup = self.soup(html)
        frame = soup.find(["frame", "iframe"], attrs={"name": frame_name})
        if frame is None:
            available = [
                f.get("name") or f.get("src", "?")
                for f in soup.find_all(["frame", "iframe"])
            ]
            raise ValueError(
                f"Frame '{frame_name}' not found in {base_url}. "
                f"Available frames: {available}"
            )
        src = frame.get("src")
        if not src:
            raise ValueError(
                f"Frame '{frame_name}' in {base_url} has no src attribute"
            )
        return urljoin(base_url, src)

    def follow_frame_chain(
        self, start_url: str, frame_names: list[str]
    ) -> tuple[str, str]:
        """Walk a chain of named frames, starting from `start_url`.

        Returns the (final_url, final_html) of the last frame in the chain.
        """
        url = start_url
        html = self.fetch(url)
        for frame_name in frame_names:
            url = self.get_frame_src(html, url, frame_name)
            html = self.fetch(url)
        return url, html

    def clean_text(self, text: str | None) -> str:
        if not text:
            return ""
        text = html_module.unescape(text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _timestamp(self) -> str:
        return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def save_response(self, url: str, body: str, prefix: str = "response") -> None:
        """Persist a response body to error_logs/ for post-mortem debugging.

        Replaces the Selenium `save_screenshot` / `save_page_source` pair —
        with httpx we already have the exact bytes the parser saw.
        """
        try:
            Path("error_logs").mkdir(parents=True, exist_ok=True)
            filename = (
                f"error_logs/{self._timestamp()}_{self.country}_{prefix}.html"
            )
            with open(filename, "w", encoding="utf-8") as fh:
                fh.write(f"<!-- source: {url} -->\n")
                fh.write(body)
            self.logger.info(f"Saved response body to '{filename}'")
        except Exception as e:
            self.logger.error(f"Failed to save response body: {e}")

    # --- Chart-PDF extraction (Stage 2, docs/chart-pdf-plan.md) -----------
    # Per-crawler opt-in: when FETCH_PDF_URLS is True, crawl() calls
    # attach_pdf_urls() to fetch every airport's chart page and store the most
    # relevant direct chart-PDF link in `pdf_url`. Selection: the priority
    # regexes are tried in order - first against each PDF link's visible TEXT,
    # then against its HREF; the first match wins, else the page's first PDF
    # link. Patterns come from the pdf_recon live-test runs (the AIP hosts are
    # not reachable from the sandboxed dev environment).
    FETCH_PDF_URLS: bool = False
    PDF_TEXT_PRIORITY: tuple[str, ...] = ()
    PDF_HREF_PRIORITY: tuple[str, ...] = ()

    def attach_pdf_urls(self, airports: list[Airport]) -> list[Airport]:
        """Best-effort chart-PDF enrichment; must run while the client is
        still open (inside crawl(), before its `finally: self.close()`).

        Every failure is per-field fail-soft: a missing PDF never blocks the
        airport row - `pdf_url` simply stays None and the website falls back
        to the chart page `url`.
        """
        if not self.FETCH_PDF_URLS:
            return airports
        found = 0
        for airport in airports:
            try:
                html = self.fetch(airport.url)
                links = self._collect_pdf_links(html, airport.url)
                airport.pdf_url = self._pick_pdf_url(links)
                airport.charts = self._to_chart_links(links) or None
                if airport.pdf_url:
                    found += 1
            except Exception as e:
                self.logger.debug(
                    f"pdf_url skip {airport.icao or airport.title}: {e}"
                )
        self.logger.info(
            f"pdf_url: {found}/{len(airports)} airports with a direct chart PDF"
        )
        return airports

    # A page never legitimately lists more charts than this; the cap bounds the
    # stored JSON (the biggest real case seen in recon was LFKJ with 42).
    MAX_CHARTS = 50

    def _collect_pdf_links(
        self, html: str, base_url: str
    ) -> list[tuple[str, str]]:
        """Every PDF link on a chart page as (visible text, absolute URL),
        deduplicated by URL, in document order."""
        soup = self.soup(html)
        links: list[tuple[str, str]] = []
        seen: set[str] = set()
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if ".pdf" not in href.lower():
                continue
            url = urljoin(base_url, href)
            if url in seen:
                continue
            seen.add(url)
            text = " ".join(link.get_text(" ", strip=True).split())
            links.append((text, url))
        return links[: self.MAX_CHARTS]

    def _to_chart_links(self, links: list[tuple[str, str]]) -> list[ChartLink]:
        """Name each chart by the source's own link text; sources that link
        bare icons (NL/PL/SE) get the filename stem instead ("EHAM-VFR-PROC")."""
        charts: list[ChartLink] = []
        for text, url in links:
            name = text
            if not name:
                stem = url.rsplit("/", 1)[-1]
                name = unquote(stem[:-4] if stem.lower().endswith(".pdf") else stem)
            charts.append(ChartLink(name=name[:120], url=url))
        return charts

    def _pick_pdf_url(self, links: list[tuple[str, str]]) -> str | None:
        if not links:
            return None
        for pattern in self.PDF_TEXT_PRIORITY:
            rx = re.compile(pattern, re.I)
            for text, href in links:
                if rx.search(text):
                    return href
        for pattern in self.PDF_HREF_PRIORITY:
            rx = re.compile(pattern, re.I)
            for text, href in links:
                if rx.search(href):
                    return href
        return links[0][1]

    def crawl(self) -> list[Airport]:
        raise NotImplementedError("Crawlers must implement crawl()")

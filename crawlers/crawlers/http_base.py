import datetime
import html as html_module
import io
import logging
import re
import ssl
import time
from pathlib import Path
from urllib.parse import unquote, urljoin

from typing import TYPE_CHECKING

import httpx
from bs4 import BeautifulSoup

from crawlers.airac import current_airac_date, is_crawl_day, next_airac_date
from crawlers.models import Airport, ChartLink

if TYPE_CHECKING:
    from crawlers.operating_hours import StructuredHours

# Re-export Airport + the AIRAC helpers so country crawlers can keep doing
# `from crawlers.http_base import Airport, HttpCrawlerBase, current_airac_date`
# in one line (the AIRAC math itself lives in the dependency-free crawlers.airac
# module so the crawl workflow gate can import it without third-party deps).
__all__ = [
    "Airport",
    "HttpCrawlerBase",
    "current_airac_date",
    "next_airac_date",
    "is_crawl_day",
]

# Honest, identifiable UA for well-behaved sources - names the crawler and
# links back to the site so an AIS admin can see who is hitting them.
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

# Below this many extracted characters a PDF is treated as an image-only scan
# with no usable text layer, and pdf_text falls back to OCR (see pdf_text).
_PDF_MIN_TEXT_LEN = 50

# The AIRAC cycle math (current_airac_date / next_airac_date / is_crawl_day)
# lives in the dependency-free crawlers.airac module and is imported + re-
# exported above; crawlers whose source URLs carry no edition date stamp
# crawl_meta.airac from current_airac_date().


class HttpCrawlerBase:
    """Base for crawlers that talk to AIP sites over plain HTTP.

    No browser, no WebDriver. Use this for any source that serves static
    HTML - including the eurocontrol-style frameset eAIPs, which are just
    chains of `<frame src="...">` references that resolve to plain pages.
    """

    # 30s overall read budget, 10s to connect - AIS servers are often slow
    # but a hung socket must not stall the nightly cron.
    timeout = httpx.Timeout(30.0, connect=10.0)
    max_retries = 3
    retry_initial_delay = 1.0  # seconds; doubles each attempt

    def __init__(self, country: str):
        # Country code is normalized upper-case; used for logging + Airport rows.
        self.country = country.upper()
        self.logger = logging.getLogger(__name__)
        # Optional AIRAC/edition date (ISO "2026-06-25") for this crawl, set by
        # a crawler that KNOWS its edition but stores date-less URLs (DE: the
        # amendment-stable BasicVFR permalinks carry no date, so the website
        # cannot derive it from the airport URLs). OutputHandler forwards it to
        # the API (?airac=), which stamps crawl_meta.airac. Left None otherwise;
        # for date-in-URL sources the website derives the edition itself.
        self.airac: str | None = None
        # Optional AUTHORITATIVE eAIP AD 2.3 operation hours, keyed by ICAO
        # (structured, see crawlers.operating_hours). A crawler that reads the
        # per-aerodrome AD 2 page (for the AD 2.1 name) can also collect AD 2.3
        # hours here; main.py PATCHes them to /api/airport-facts with
        # hoursSource="eaip" after the airport publish. Empty for crawlers that
        # do not populate it.
        self.hours_by_icao: dict[str, "StructuredHours | None"] = {}
        # Per-ICAO hours PROVENANCE override (default is the publish call's
        # source, "eaip"). Set to "pdf-ocr-hours" for a field whose AD 2.3 hours
        # came from the OCR fallback of an image-only PDF (see pdf_text /
        # _last_pdf_ocr below), so the website shows the machine-read disclaimer
        # and ranks them below clean eAIP hours. Empty for clean-text crawlers.
        self.hours_source_by_icao: dict[str, str] = {}
        # Whether the MOST RECENT pdf_text() call fell back to OCR (image-only
        # PDF). A caller that turns that text into hours reads this right after
        # to stamp hours_source_by_icao. Reset on every pdf_text call.
        self._last_pdf_ocr: bool = False
        # Optional AUTHORITATIVE eAIP AD 2.13 declared distances, keyed by ICAO
        # ({designator: {tora,toda,asda,lda}} metres, see
        # crawlers.declared_distances). Populated by a eurocontrol crawler that
        # reads the per-aerodrome AD 2 page; main.py PATCHes it to
        # /api/airport-facts (source "eaip"). Empty otherwise.
        self.declared_by_icao: dict[str, object] = {}
        # One pooled client per crawler: follows redirects (frameset eAIPs
        # bounce through several), default honest UA. http2=False because some
        # AIS stacks negotiate HTTP/2 badly; HTTP/1.1 is the safe common path.
        self.client = httpx.Client(
            follow_redirects=True,
            timeout=self.timeout,
            headers={"User-Agent": DEFAULT_USER_AGENT},
            http2=False,
        )
        # Proxy / CA / legacy-TLS kwargs last applied via `_rebuild_client`, so
        # the client can be reopened with the SAME config after crawl() closes
        # it (see `ensure_client_open` - used by the post-crawl AD 2.3 fetch to
        # still reach broken-chain / proxied hosts like SI).
        self._client_kwargs: dict = {}

    # Context-manager support so a crawler can `with SomeCrawler("DE") as c:`
    # and be guaranteed the httpx client (and any browser) is torn down.
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def close(self) -> None:
        """Close the pooled httpx client; never raises (best-effort cleanup)."""
        try:
            self.client.close()
        except Exception:
            pass

    def ensure_client_open(self) -> None:
        """Reopen the pooled client if it was closed (crawl() closes it in its
        `finally: self.close()`), preserving any proxy / CA / legacy-TLS config
        so a POST-crawl fetch - the AD 2.3 hours pass - still reaches
        broken-chain (SI) or proxied hosts. Browser headers are not restored;
        the AD 2.3 fetch is fail-soft, so a WAF block just leaves the field
        without eAIP hours."""
        if getattr(self.client, "is_closed", True):
            self.client = httpx.Client(
                follow_redirects=True,
                timeout=self.timeout,
                headers={"User-Agent": DEFAULT_USER_AGENT},
                http2=False,
                **self._client_kwargs,
            )

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
        self._rebuild_client(proxy=proxy_url, verify=False)
        # Log without credentials.
        safe = proxy_url.split("@")[-1]
        self.logger.info(f"{self.country}: routing via proxy {safe}")

    def use_extra_ca(self, pem_url: str) -> None:
        """Verify TLS against the default bundle PLUS a pinned intermediate.

        For sources whose server sends a wrong or incomplete certificate
        chain (SI: aim.sloveniacontrol.si presents the wrong RapidSSL
        intermediate - see crawlers/recon/probe-si.md). The missing
        intermediate is fetched over a normally VERIFIED connection from
        its issuer's public repository (e.g.
        https://cacerts.digicert.com/RapidSSLTLSRSACAG1.crt.pem) and added
        to the trust store. Verification stays fully enabled - this is the
        sanctioned alternative to ``verify=False`` for broken-chain hosts.
        """
        r = httpx.get(pem_url, timeout=self.timeout, follow_redirects=True)
        r.raise_for_status()
        pem = r.text
        if "BEGIN CERTIFICATE" not in pem:
            raise ValueError(f"Not a PEM certificate: {pem_url}")
        ctx = ssl.create_default_context()
        ctx.load_verify_locations(cadata=pem)
        self._rebuild_client(verify=ctx)
        self.logger.info(
            f"{self.country}: TLS trust extended with "
            f"{pem_url.rsplit('/', 1)[-1]}"
        )

    def use_legacy_tls(self) -> None:
        """Allow a legacy TLS handshake for ancient server stacks.

        IE (iaip.iaa.ie) answers every modern ClientHello with a fatal
        alert 40 before certificates are exchanged (see
        crawlers/recon/probe-ie-bg.md): TLSv1 minimum, SECLEVEL=0 cipher
        list and legacy renegotiation give the handshake a chance.
        Certificate verification STAYS enabled.
        """
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        ctx.set_ciphers("DEFAULT@SECLEVEL=0")
        ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0)
        self._rebuild_client(verify=ctx)
        self.logger.info(
            f"{self.country}: legacy TLS handshake enabled (verification on)"
        )

    def _rebuild_client(self, **kwargs) -> None:
        """Swap self.client, carrying the accumulated headers over.

        httpx has no way to change proxy/verify on a live client, so the
        proxy/CA/legacy-TLS helpers rebuild it. Preserving the headers keeps
        an earlier ``use_browser_headers()`` in effect across the swap.
        """
        headers = dict(self.client.headers)
        self.client.close()
        self._client_kwargs = dict(kwargs)
        self.client = httpx.Client(
            follow_redirects=True,
            timeout=self.timeout,
            headers=headers,
            http2=False,
            **kwargs,
        )

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
            # Optional filter: only log links whose href OR text matches.
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

    def pdf_text(self, url: str) -> str:
        """Download a PDF and return its text (collapsed to single-spaced), or
        "" on any error (fail-soft). Bypasses the HTML-only `fetch()` guard on
        purpose - this is the ONE place the crawler wants a binary document (a
        full-document AD-2 PDF whose AD 2.3 OPERATIONAL HOURS table is not
        published as HTML, e.g. ES/ENAIRE). pypdf is imported lazily so importing
        a crawler never needs it. Reuses `self.client` (proxy / CA / headers).

        OCR fallback: when the PDF has (almost) no extractable text layer - a
        scanned/image-only eAIP PDF - the pages are rasterised and OCR'd (see
        `_pdf_ocr_text`). `self._last_pdf_ocr` records whether THIS call used
        that fallback, so a caller turning the text into AD 2.3 hours can stamp
        `hours_source_by_icao[icao] = "pdf-ocr-hours"` (noisy -> disclaimer +
        sub-eAIP rank). OCR text is a best-effort, machine-read source."""
        self._last_pdf_ocr = False
        try:
            resp = self.client.get(url)
            resp.raise_for_status()
            content = resp.content
        except Exception as exc:  # a bad/missing PDF must not abort the crawl
            self.logger.debug(f"pdf_text failed for {url}: {exc}")
            return ""

        text = ""
        try:
            from pypdf import PdfReader  # lazy: not needed to import a crawler

            reader = PdfReader(io.BytesIO(content))
            text = " ".join(
                " ".join((page.extract_text() or "").split())
                for page in reader.pages
            ).strip()
        except Exception as exc:  # pypdf missing / unreadable -> try OCR below
            self.logger.debug(f"pdf_text: pypdf read failed for {url}: {exc}")

        # An effectively empty text layer means an image-only PDF -> OCR it.
        if len(text) >= _PDF_MIN_TEXT_LEN:
            return text
        ocr = self._pdf_ocr_text(content)
        if ocr:
            self._last_pdf_ocr = True
            self.logger.info(f"pdf_text: used OCR fallback for {url}")
            return ocr
        return text

    def _pdf_ocr_text(self, pdf_bytes: bytes) -> str:
        """Rasterise up to `MAX_OCR_PAGES` of a PDF and OCR them with Tesseract
        (via `de_ocr.ocr_pil`, `PDF_OCR_LANG`). Returns collapsed text, or "" on
        any failure (missing pypdfium2 / Tesseract / bad PDF) - fully fail-soft.
        pypdfium2 is a permissively-licensed, pure-wheel PDF rasteriser (bundled
        PDFium, no system dependency), imported lazily so a renderer-less env
        still imports the crawler."""
        try:
            import pypdfium2 as pdfium
        except Exception as exc:  # renderer missing -> no OCR, never a crash
            self.logger.warning(f"_pdf_ocr_text: pypdfium2 unavailable ({exc})")
            return ""
        from crawlers.de_ocr import ocr_pil  # local: avoids an import cycle

        doc = None
        try:
            doc = pdfium.PdfDocument(pdf_bytes)
            parts: list[str] = []
            for i in range(min(len(doc), self.MAX_OCR_PAGES)):
                # ~200 DPI (scale = 200/72) is a good OCR accuracy/speed balance.
                bitmap = doc[i].render(scale=200 / 72)
                text = ocr_pil(bitmap.to_pil(), self.PDF_OCR_LANG)
                if text:
                    parts.append(text)
            return " ".join(" ".join(parts).split())
        except Exception as exc:
            self.logger.debug(f"_pdf_ocr_text failed: {exc}")
            return ""
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass

    def collect_pdf_hours(self, icao: str, pdf_url: str) -> None:
        """Parse a field's AD 2.3 operation hours from a PDF and record them
        keyed by ICAO, stamping the OCR provenance ("pdf-ocr-hours") when the
        text came from the image-only-PDF OCR fallback (see pdf_text). This is
        the ONE place the `_last_pdf_ocr` flag is read, so the six PDF-based
        crawlers (ES/GR/RO/MK/RS/DK) share a single fail-soft implementation
        instead of repeating the fetch + parse + provenance dance. `ad23_hours`
        is imported lazily to avoid an import cycle (http_eurocontrol_base
        subclasses this module)."""
        from crawlers.http_eurocontrol_base import ad23_hours

        try:
            hrs = ad23_hours(self.pdf_text(pdf_url))
        except Exception as e:  # a bad PDF must never abort the crawl
            self.logger.debug(f"{self.country}: {icao} AD 2.3 hours failed: {e}")
            return
        if hrs:
            self.hours_by_icao[icao] = hrs
            if self._last_pdf_ocr:
                self.hours_source_by_icao[icao] = "pdf-ocr-hours"

    def fetch_response(self, url: str) -> httpx.Response:
        """Fetch a URL and return the httpx Response (redirects followed).

        Callers that need the FINAL post-redirect URL (e.g. to resolve
        relative links on a redirected landing page) use this and read
        ``str(response.url)``; `fetch()` wraps it for body-only callers.

        Retries up to ``max_retries`` times on connection errors and on
        retryable 5xx / 429 responses, with exponential backoff. Other 4xx
        responses propagate immediately - those are typically caller bugs,
        not transient.

        HTML only: URLs with an image/binary extension are refused before
        any request is made, and responses with an image/binary
        Content-Type are rejected after the fact - the crawlers never need
        anything but navigation HTML, and this keeps metered proxy traffic
        (Bright Data) down to those small text documents.
        """
        # Pre-request guard: reject obvious binary URLs before spending a request.
        if _BINARY_URL_RE.search(url):
            raise ValueError(
                f"Refusing to fetch non-HTML resource {url} - the crawler "
                "fetches HTML navigation pages only"
            )
        self.logger.debug(f"GET {url}")
        delay = self.retry_initial_delay
        last_exc: Exception | None = None

        # Attempt 1..max_retries; backoff doubles between attempts (1s, 2s, ...).
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.client.get(url)
            except httpx.TransportError as exc:
                # Connection-level failure (DNS/TLS/reset/timeout) - retryable.
                last_exc = exc
                if attempt < self.max_retries:
                    self.logger.warning(
                        f"GET {url} transport error ({exc!s}); "
                        f"retry {attempt}/{self.max_retries - 1} in {delay:.1f}s"
                    )
                    time.sleep(delay)
                    delay *= 2
                continue

            # Transient server response (5xx / 429) - retry with backoff.
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

            # 2xx success or non-retryable 4xx/3xx - bail out of the loop.
            # raise_for_status() turns a non-retryable 4xx into an exception
            # (caller bug), and 2xx falls through to the content-type guard.
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            # Post-request guard: even a 200 must be HTML, not a binary payload.
            if _BINARY_CONTENT_TYPE_RE.match(content_type.strip()):
                raise ValueError(
                    f"{url} returned non-HTML content type "
                    f"{content_type!r} - the crawler fetches HTML "
                    "navigation pages only"
                )
            return response

        # Exhausted all retries - re-raise the last failure so the caller sees it.
        assert last_exc is not None
        raise last_exc

    def soup(self, html: str, *, parser: str = "html.parser") -> BeautifulSoup:
        """Parse HTML into BeautifulSoup (stdlib html.parser, no lxml dep)."""
        return BeautifulSoup(html, parser)

    def get_frame_src(self, html: str, base_url: str, frame_name: str) -> str:
        """Resolve the `src` attribute of a `<frame>` / `<iframe>` by name.

        eurocontrol eAIPs are framesets; navigation means chasing named frames.
        Returns the src joined onto base_url (absolute); raises ValueError with
        the list of available frames if the named one is missing - so a layout
        change surfaces a readable diagnostic instead of a KeyError.
        """
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

        Fetches start_url, then for each name resolves that frame's src and
        fetches it, using the previous page as the base for relative hrefs.
        Returns the (final_url, final_html) of the last frame in the chain -
        typically the actual AD-2 navigation document.
        """
        url = start_url
        html = self.fetch(url)
        for frame_name in frame_names:
            url = self.get_frame_src(html, url, frame_name)
            html = self.fetch(url)
        return url, html

    def clean_text(self, text: str | None) -> str:
        """Unescape HTML entities and collapse runs of whitespace to one space."""
        if not text:
            return ""
        text = html_module.unescape(text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _timestamp(self) -> str:
        # Sortable timestamp for uniquely naming saved-response debug files.
        return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def save_response(self, url: str, body: str, prefix: str = "response") -> None:
        """Persist a response body to error_logs/ for post-mortem debugging.

        Replaces the Selenium `save_screenshot` / `save_page_source` pair -
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
    # Master switch: subclass sets True to opt into per-airport PDF fetching.
    FETCH_PDF_URLS: bool = False
    # Regexes tried (in order) against each PDF link's visible TEXT; first hit wins.
    PDF_TEXT_PRIORITY: tuple[str, ...] = ()
    # Regexes tried (in order) against each PDF link's HREF; used if no TEXT hit.
    PDF_HREF_PRIORITY: tuple[str, ...] = ()

    # Tesseract language for the pdf_text OCR fallback (image-only PDFs). English
    # base is always installed and the AD 2.3 parse targets English tokens; a
    # per-country crawler overrides it with its own language pack plus "eng"
    # (e.g. GR "ell+eng", RO "ron+eng") so the glyphs read cleanly. The pack must
    # be installed on the runner (see the crawl / live-test workflows).
    PDF_OCR_LANG: str = "eng"
    # Max PDF pages the OCR fallback rasterises (AD 2.3 sits early in the AD-2
    # document); bounds OCR time on a large scanned book.
    MAX_OCR_PAGES: int = 5

    def attach_pdf_urls(self, airports: list[Airport]) -> list[Airport]:
        """Best-effort chart-PDF enrichment; must run while the client is
        still open (inside crawl(), before its `finally: self.close()`).

        Every failure is per-field fail-soft: a missing PDF never blocks the
        airport row - `pdf_url` simply stays None and the website falls back
        to the chart page `url`.
        """
        # Opt-out fast path: crawlers that didn't enable this pay nothing.
        if not self.FETCH_PDF_URLS:
            return airports
        found = 0
        for airport in airports:
            try:
                # Open the field's chart page, harvest every PDF link, then
                # pick the primary one and store the full list.
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
            # Only anchors pointing at a .pdf (substring match tolerates query
            # strings / fragments after the extension).
            if ".pdf" not in href.lower():
                continue
            url = urljoin(base_url, href)
            # Dedupe by absolute URL, preserving first-seen (document) order.
            if url in seen:
                continue
            seen.add(url)
            text = " ".join(link.get_text(" ", strip=True).split())
            links.append((text, url))
        # Cap to bound the stored JSON regardless of a pathological page.
        return links[: self.MAX_CHARTS]

    def _to_chart_links(self, links: list[tuple[str, str]]) -> list[ChartLink]:
        """Name each chart by the source's own link text; sources that link
        bare icons (NL/PL/SE) get the filename stem instead ("EHAM-VFR-PROC")."""
        charts: list[ChartLink] = []
        for text, url in links:
            name = text
            if not name:
                # No link text: derive a name from the filename, stripping the
                # .pdf and URL-decoding (%20 etc.).
                stem = url.rsplit("/", 1)[-1]
                name = unquote(stem[:-4] if stem.lower().endswith(".pdf") else stem)
            # Truncate to keep the stored name bounded.
            charts.append(ChartLink(name=name[:120], url=url))
        return charts

    def _pick_pdf_url(self, links: list[tuple[str, str]]) -> str | None:
        """Choose the single most relevant PDF as the primary `pdf_url`.

        Priority: any TEXT-priority regex hit, else any HREF-priority hit,
        else the first PDF on the page. Returns None when the page has none.
        """
        if not links:
            return None
        # 1) Prefer a link whose visible text matches a text-priority pattern.
        for pattern in self.PDF_TEXT_PRIORITY:
            rx = re.compile(pattern, re.I)
            for text, href in links:
                if rx.search(text):
                    return href
        # 2) Else a link whose href matches an href-priority pattern.
        for pattern in self.PDF_HREF_PRIORITY:
            rx = re.compile(pattern, re.I)
            for text, href in links:
                if rx.search(href):
                    return href
        # 3) Else fall back to the first PDF in document order.
        return links[0][1]

    def crawl(self) -> list[Airport]:
        """Return the country's airports. Subclasses MUST implement this."""
        raise NotImplementedError("Crawlers must implement crawl()")

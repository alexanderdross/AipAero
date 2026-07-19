"""Playwright rendering fallback for JS-rendered AIP sources.

Most national eAIPs are static HTML (see :class:`HttpCrawlerBase` /
:class:`HttpEurocontrolBase`) and never need a browser. A growing minority
ship a client-side JS viewer with no server-rendered navigation - the Danish
Naviair AIM (aim.naviair.dk) is the first, and the Swedish/Polish sources
already publish parallel ``index-v2.html`` JS viewers. For those, this base
adds :meth:`render_html`, which drives a headless Chromium via Playwright and
returns the DOM after the page's scripts have run, so the same BeautifulSoup
parsing used elsewhere applies to the rendered markup.

Design rules:

* **netcup / self-hosted runner only.** A browser must never run on the
  Cloudflare Worker (or any serverless function) - it is the one allowed
  browser fallback and it lives with the crawlers, which already run on the
  netcup VM under systemd.
* **Lazy import.** ``playwright`` is imported inside :meth:`render_html`, not
  at module load, so importing a crawler (the CI import-smoke test, a
  browserless dev box) never requires the browser to be installed.
* **Fail-soft.** A missing browser / launch failure raises a clear
  ``PlaywrightUnavailable`` that the crawler's ``crawl()`` already catches and
  turns into "0 airports" rather than a hard crash.

Install the browser once on the host: ``uv run playwright install chromium``
(add ``--with-deps`` for the system libraries on a fresh box).
"""

from __future__ import annotations

from crawlers.http_base import BROWSER_USER_AGENT, HttpCrawlerBase


class PlaywrightUnavailable(RuntimeError):
    """Raised when the headless browser cannot be used (not installed, launch
    failed). Callers fail soft on it - the source stays unavailable rather
    than crashing the whole crawl run."""


class PlaywrightCrawlerBase(HttpCrawlerBase):
    """Adds a headless-Chromium rendering path to the httpx crawler base.

    Subclasses call :meth:`render_html` in place of :meth:`fetch` for pages
    whose content is only present after client-side JS has run. The httpx
    helpers (``soup``, ``clean_text``, ``log_candidate_links``, ...) still
    apply to the returned, fully-rendered HTML.
    """

    # Give SPA bundles room to boot and fetch their data; still bounded so a
    # hung page fails the run instead of blocking the nightly cron forever.
    render_timeout_ms = 30000

    def __init__(self, country: str) -> None:
        super().__init__(country)
        # Playwright driver + browser handles; created on first render, reused
        # across calls, torn down in close(). None until _ensure_browser runs.
        self._pw = None
        self._browser = None

    def _ensure_browser(self):
        """Launch (once) and return a headless Chromium browser.

        Lazily imports playwright so a browserless environment can still import
        the crawler; raises PlaywrightUnavailable when the package or the
        Chromium binary is missing, which crawlers catch to fail soft.
        """
        # Reuse an already-launched browser across multiple render_html calls.
        if self._browser is not None:
            return self._browser
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as e:  # package not installed at all
            raise PlaywrightUnavailable(
                "playwright is not installed - run "
                "'uv run playwright install chromium' on the crawler host"
            ) from e
        try:
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(headless=True)
        except Exception as e:  # browser binary missing / sandbox / etc.
            raise PlaywrightUnavailable(
                f"could not launch headless Chromium: {e}"
            ) from e
        return self._browser

    def render_html(
        self,
        url: str,
        *,
        wait_selector: str | None = None,
        wait_until: str = "networkidle",
        wait_ms: int = 0,
        capture_network: bool = False,
    ) -> str:
        """Load ``url`` in a headless browser and return the rendered DOM.

        ``wait_until`` is the Playwright navigation wait state
        ("load" | "domcontentloaded" | "networkidle"); ``wait_selector``, if
        given, additionally waits for that CSS selector to appear (use it when
        the nav tree is injected after the initial network settles);
        ``wait_ms`` adds a fixed settle time after that (SPAs that fire late
        XHRs after networkidle). With ``capture_network=True`` every response
        the page triggers is recorded in :attr:`last_network` (url, status,
        content type, size, plus a body snippet for small JSON/text) - the
        reconnaissance tool for SPAs whose data arrives via XHR instead of
        anchors (DK/Naviair treegrid). Raises :class:`PlaywrightUnavailable`
        if the browser is unusable.
        """
        browser = self._ensure_browser()
        # Fresh isolated context per render (own cookies/cache); browser-like
        # UA + en-GB so the SPA serves the English navigation.
        context = browser.new_context(
            user_agent=BROWSER_USER_AGENT,
            locale="en-GB",
        )
        page = context.new_page()
        # Reset the network log; populated below only when capture_network is on.
        self.last_network: list[dict] = []
        if capture_network:

            # Per-response callback: record a compact entry for every response.
            def _record(response) -> None:
                try:
                    ctype = response.headers.get("content-type", "")
                    entry = {
                        "url": response.url,
                        "status": response.status,
                        "ctype": ctype.split(";")[0],
                        "body": "",
                    }
                    # Body snippets only for data-ish payloads - that is what
                    # identifies the tree/data endpoint.
                    if any(t in ctype for t in ("json", "xml", "text/plain")):
                        body = response.text()
                        entry["size"] = len(body)
                        entry["body"] = " ".join(body[:400].split())
                    self.last_network.append(entry)
                except Exception:
                    # Redirect bodies etc. are unreadable - keep the URL line.
                    self.last_network.append(
                        {"url": response.url, "status": response.status,
                         "ctype": "?", "body": ""}
                    )

            page.on("response", _record)
        try:
            # Navigate and wait for the requested load state (default networkidle).
            page.goto(url, wait_until=wait_until, timeout=self.render_timeout_ms)
            # Optionally wait for a specific element (nav tree injected late).
            if wait_selector:
                page.wait_for_selector(
                    wait_selector, timeout=self.render_timeout_ms
                )
            # Optional fixed settle for SPAs that fire XHRs after networkidle.
            if wait_ms:
                page.wait_for_timeout(wait_ms)
            self.logger.info(f"{self.country}: rendered {url}")
            # Record the final URL after any client-side redirect (e.g. DFS
            # serves a meta-refresh stub that lands on an edition-specific
            # page); callers resolve the rendered page's relative links against
            # THIS, not the requested stub URL.
            self.last_url = page.url
            # Serialized post-JS DOM - fed to the same BS4 parsing as httpx HTML.
            return page.content()
        finally:
            # Always drop the context (the browser stays up for reuse).
            context.close()

    def log_network_capture(self, *, limit: int = 40) -> None:
        """Log the responses captured by the last ``capture_network`` render -
        data payloads (JSON/XML) first, static assets compressed to one line
        each. Diagnostic output for the live-crawl test."""
        entries = getattr(self, "last_network", [])
        if not entries:
            self.logger.warning(f"{self.country}: no network capture recorded")
            return
        data = [e for e in entries if e.get("body")]
        other = [e for e in entries if not e.get("body")]
        self.logger.warning(
            f"{self.country}: network capture: {len(entries)} responses, "
            f"{len(data)} with data payloads:"
        )
        for e in data[:limit]:
            self.logger.warning(
                f"  DATA {e['status']} {e['ctype']} "
                f"({e.get('size', '?')} B) {e['url'][:140]}"
            )
            self.logger.warning(f"       body: {e['body'][:300]}")
        for e in other[:limit]:
            self.logger.warning(f"  {e['status']} {e['ctype']} {e['url'][:140]}")

    def close(self) -> None:
        """Tear down the browser (if launched) and the httpx client."""
        try:
            if self._browser is not None:
                self._browser.close()
        except Exception:
            pass
        try:
            if self._pw is not None:
                self._pw.stop()
        except Exception:
            pass
        self._browser = None
        self._pw = None
        super().close()

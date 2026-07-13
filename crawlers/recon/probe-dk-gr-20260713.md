# DK/GR-Validierungslauf 13.07.2026 (Run 29284116589) - beide NICHT launchbar

Ziel war der Launch der beiden letzten verdrahteten, aber versteckten
Länder. Ergebnis: beide Crawler liefern 0 Airports; die Ursachen sind
unterschiedlich und dokumentiert. `crawl-error-responses`-Artefakt (24
Dateien, save_response-Post-Mortem, 7 Tage):
https://github.com/alexanderdross/AipAero/actions/runs/29284116589/artifacts/8292480679

## DK (Naviair) - Playwright rendert, aber die Angular-App liefert keine Links

```
INFO crawlers.http_base: DK: rendered https://aim.naviair.dk/
WARNING crawlers.http_base: DK: no nav link matching ('VFR Flight Guide',) under https://aim.naviair.dk/
WARNING crawlers.http_base: DK: 1 links on https://aim.naviair.dk/; first 1:
WARNING crawlers.http_base:   'Ændringer til AIP/VFG/AIC' -> /aendringer-til-aipvfgaic/
WARNING crawlers.http_base: DK: candidate data URLs: ['/media/images/naviair_sort_246px.png', '/templates/treegrid.html', ...]
```

Der Chromium-Render funktioniert (kein PlaywrightUnavailable), aber der
gerenderte DOM enthält nur EINEN Anchor und ein Angular-Treegrid-Template
(`/templates/treegrid.html`) - der eigentliche AIP-Baum wird per XHR in
ein Treegrid geladen, das der Render-Snapshot nicht (oder noch nicht)
enthält. NÄCHSTER SCHRITT: im Playwright-Render auf das Treegrid warten
(wait_for_selector) ODER den XHR-Endpunkt identifizieren, den das
Treegrid abruft (Netzwerk-Trace im Render; vermutlich eine JSON-Route
unterhalb von aim.naviair.dk), und direkt den JSON-Endpunkt crawlen -
das wäre robuster als DOM-Scraping.

## GR (HASP/aisgr) - blockt jetzt auch den Web Unlocker

```
INFO crawlers.http_base: GR: routing via Bright Data Web Unlocker
INFO httpx: HTTP Request: GET https://aisgr.hasp.gov.gr/ "HTTP/1.1 502 Forbidden"
INFO httpx: HTTP Request: GET https://aisgr.hasp.gov.gr/ "HTTP/1.1 502 Access denied"
ERROR crawlers.http_base: GR crawl failed: retryable status 502
```

Die 502-Reason-Phrases ("Forbidden"/"Access denied") sind die
Ablehnung des Ziels gegenüber dem Unlocker selbst - gleiches Muster wie
SK (aim.lps.sk). GEPARKT wie SK; DK/GR bleiben aus `liveCountries` und
damit aus Sitemap/Startseite draußen.

===== SUMMARY =====
  DK: FAILED / 0 airports (allowed - known-blocked source)
  GR: FAILED / 0 airports (allowed - known-blocked source)

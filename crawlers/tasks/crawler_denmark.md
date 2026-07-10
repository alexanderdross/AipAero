# Python Crawler for Denmark

## Goal

Your goal is to extract the airports of Denmark. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "mil" or lastly "aeroport" if it not specified which type)
- Country Code (two letter), **for Denmark use "DK"**

## Implementation

1. You create a new file for your crawler in `crawlers/crawlers/`.
2. You create a class and you **must inherit the base class `HttpCrawlerBase`** (from `crawlers.http_base`) — or **`HttpEurocontrolBase`** (from `crawlers.http_eurocontrol_base`) when the source is a eurocontrol-style eAIP frameset — and implement the `crawl(self) -> list[Airport]` method.
3. You implement `crawl()` by fetching the static HTML with **httpx + BeautifulSoup** (no Selenium, no browser). The base class provides `fetch()`, `soup()`, `get_frame_src()`, `follow_frame_chain()`, `clean_text()` and `save_response()`; the eurocontrol base additionally provides `extract_airports_from_html()`.
4. Your `crawl()` method **returns** the `list[Airport]`. You do **not** post the results yourself — the framework's `OutputHandler` posts them to the API.
5. You register your crawler in `main.py`.

> If a future source genuinely requires JS rendering, the only allowed browser fallback is a single Playwright (Python) path — never Selenium, never Puppeteer/Node.

## Output

Your `crawl()` method returns a list of `Airport` objects:

```python
class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(alias="type")
```

You just return this list from `crawl()`; the framework's `OutputHandler` posts the results to the API. `aeroport` is the fallback type used when the source does not categorise the airfield.

## What should you extract in detail for Denmark?

**This is the URL to be crawled:** 

https://aim.naviair.dk/

### airport_type
You see the following. We need chapter `02. VFR Flight Guide Danmark`:

```
01. AIP Danmark
02. VFR Flight Guide Danmark
03. AIP Færøerne
04. AIP Grønland
05. Aeronautical Information Circulars - AIC series A
06. Aeronautical Information Circulars - AIC series B
07. DQR - Non compliant list
```

You expand `02. VFR Flight Guide Danmark`, you see the following:
```
VFG
VFG AIRAC AMDT
VFG Part 1 - GENERELT (GEN)
VFG Part 2 - EN ROUTE (ENR)
VFG Part 3 - FLYVEPLADSER (AD)
VFG SUP
```

You expand `VFG Part 3 - FLYVEPLADSER (AD)`, you see the following:
```
AD 1 - AERODROMES_HELIPORTS - INTRODUCTION
AD 2 - PUBLIC AERODROMES --> needed as category "vfr"
AD 3 - HELIPORTS --> needed as category "heliports"
AD 4 - PRIVATE AERODROMES
```

### title
The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end without "-", so e.g. instead of `Anholt - EKAT` we want `Anholt EKAT`.

### icao
The ICAO Code is the 4 letter sign on the airports, e.g. `EKAT` in `Anholt - EKAT`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the ADC airport charts, so the link where the href title contains ADC, e.g. EK_AD_2_EKEB_ADC_en.pdf.

### country
As already mentioned, the country code (two letter) **for Denmark is "DK"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
## Live-test finding (2026-07-09): AngularJS SPA, tree not statically reachable

A live render of `https://aim.naviair.dk/` exposes almost nothing to the parser:
only 1 anchor (`Ændringer til AIP/VFG/AIC`), 2 buttons (navbar toggle + an
`ng-hide` button), no iframe. The only structural hint is `/templates/treegrid.html`
- an AngularJS tree-grid template. The AIP/VFG tree is injected client-side after
an async fetch/route change that has NOT completed when `render_html` scrapes the
DOM, and the nodes are click-driven Angular tree items with no `<a href>`.

Implication: the current text-based link-follow (`_follow`) cannot navigate it. A
fix needs either (a) `PlaywrightCrawlerBase` extended with click-navigation +
wait-for-selector to expand VFG → Part 3 → AD 2 / AD 3, or (b) discovering the
tree's data endpoint via network interception and querying it directly. Until
then DK stays in `ALLOWED_FAILURES`.

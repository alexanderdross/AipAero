# Python Crawler for France

## Goal

Your goal is to extract the airports of France. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "mil" or lastly "aeroport" if it not specified which type)
- Country Code (two letter), **for France use "FR"**

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

## What should you extract in detail for France?

1. Crawl https://www.sia.aviation-civile.gouv.fr/plandesite **(it is the only static URL):** 
2. Extract the link to `eAIP FRANCE` 
3. Go there / crawl this link
4. Extract the link to the `Currently Effective eAIP`
3. Go there / crawl this link

### airport_type
You see the following. We need AD 2 and AD 3:

```
-PARTIE 3 AERODROMES (AD)
+AD 0
+AD 1 AERODROMES/HELISTATIONS - INTRODUCTION
+AD 2 AÉRODROMES
+AD 2 AERODROMES CIVILS DOTES DE PROCEDURES IFRS --> needed as category "ifr"
+AD 2 AERODROMES VFR CIVILS DOTES DE PROCEDURES IFR POUR HELICOPTERES --> needed as category "heliport"
+AD 2 AERODROMES MILITAIRES --> needed as category "military"
+AD 3 HELISTATIONS --> needed as category "heliport"
```

If you expand a section, you see actual airports.

### title
The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end, so e.g. instead of `LFBA AGEN LA GARENNE` we want `AGEN LA GARENNE LFBA`.

### icao
The ICAO Code is the 4 letter sign on the airports, e.g. `LFBA` in `LFBA AGEN LA GARENNE`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the airport charts. To have to see it, you have to expand a airport (with the '+' sign). Then you have to find the `href` / URL of the section that contains the word "Cartes relatives" in the title, e.g. `AD 2.24 LFBA  Cartes relatives à l'aérodrome`.

### country
As already mentioned, the country code (two letter) **for France is "FR"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
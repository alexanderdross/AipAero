# Python Crawler for Greece

## Goal

Your goal is to extract the airports of Greece. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "mil" or lastly "aeroport" if it not specified which type)
- Country Code (two letter), **for Greece use "GR"**

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

## What should you extract in detail for Greece?

1. Crawl https://aisgr.hasp.gov.gr/. If you have trouble passing the captcha, contact me so that I can give you a web proxy.
2. Extract the link to `Browse` of the "Effective" AIP
3. Go there / crawl this link
4. Extract the link to the `AIP` button with the airplane
3. Go there / crawl this link
5. Click on the `AIP GREECE | Aeronautical Information Publication` button

### airport_type
You see the following. We need AD 2 and AD 3:

```
Part 3 AERODROMES (AD)
    AD 0
    AD 1 AERODROMES/HELIPORTS - INTRODUCTION
    AD 1.6 DIRECTORY of Category B Aerodromes and Water Aerodromes
    AD 2 AERODROMES
    AD 3 HELIPORTS 
```

If you expand a section, you see actual airports.

### title
The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end, so e.g. instead of `LGAV ATHINAI/Eleftherios Venizelos` we want `ATHINAI/Eleftherios Venizelos LGAV`.

### icao
The ICAO Code is the 4 letter sign on the airports, e.g. `LGAV` in `LGAV ATHINAI/Eleftherios Venizelos`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the airport charts. To have to see it, you have to expand a airport (with the '+' sign). Then you have to find the `href` / URL of the section that contains the words "Charts related" in the title, e.g. `AD 2.24 LGAV CHARTS RELATED TO THE AERODROME`.

### country
As already mentioned, the country code (two letter) **for Greece is "GR"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
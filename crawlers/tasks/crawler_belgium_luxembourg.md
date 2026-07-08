# Python Crawler for Belgium and Luxembourg Airports

## Goal

Your goal is to extract the airports of Belgium and Luxembourg. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "mil" or lastly "aeroport" if it not specified which type)
- Country Code (two letter), **for belgium and luxembourg use "BE"**

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

## What should you extract in detail for Belgium and Luxembourg?

**This is the URL to be crawled:** 

https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/index-en-GB.html 

### airport_type
On the left side you see the following. The airport chapters start with "AD 2" and "AD 3":

```
Part 3 AERODROMES (AD)
+AD 0 INTRODUCTION 
+AD 1 AERODROMES/HELIPORTS - INTRODUCTION
+AD 2 PUBLIC AERODROMES --> needed as category "ifr"
+AD 2 MILITARY AERODROMES --> needed as category "military"
+AD 2 PRIVATE AERODROMES --> needed as category "vfr"
+AD 2 ULM AERODROMES --> needed as category "vfr"
+AD 2 PERSONAL AERODROMES --> needed as category "vfr"
+AD 3 MILITARY HELIPORTS --> needed as category "heliport"
+AD 3 HOSPITAL HELIPORTS --> needed as category "heliport"
+AD 3 PRIVATE HELIPORTS --> needed as category "heliport"
+AD 3 PERSONAL HELIPORTS --> needed as category "heliport"
```

### title
When you click on the '+' of each category, you see the actual list of airports. The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end, so e.g. instead of `EBAW ANTWERPEN / Deurne` we want `ANTWERPEN / Deurne EBAW`.

### icao
The ICAO Code is the 4 letter sign on most airports, e.g. `EBAW` in `EBAW ANTWERPEN / Deurne`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the airport charts. To have to see it, you have to expand a airport (with the '+' sign). Then you have to find the `href` / URL of the section that contains the word "Charts Related" in the title, e.g. `AD 2.24 EBAW Charts Related to EBAW`

### country
As already mentioned, the country code (two letter) **for belgium and luxembourg is "BE"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
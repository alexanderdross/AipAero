# Python Crawler for Czech Airports

## Goal

Your goal is to extract the airports of Czech. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "mil" or lastly "aeroport" if it not specified which type)
- Country Code (two letter), **for Czech use "CZ"**

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

## What should you extract in detail for Czech?

**This is the URL to be crawled:** 

https://aim.rlp.cz/eaip/html/index-en-GB.html

### airport_type
On the left side you see the following. The airport chapters start with 4 capital letters:

- PART 3 - AERODROMES (AD)
+AD 0
+AD 1 AERODROMES/HELIPORTS − INTRODUCTION
+ LKTB BRNO/Tuřany --> needed as category "ifr"
+ LKCV Čáslav --> needed as category "ifr"
+ LKCS České Budějovice --> needed as category "ifr"
+ LKKV Karlovy Vary --> needed as category "ifr"
+ LKKB Kbely --> needed as category "ifr"
+ LKKU Kunovice --> needed as category "ifr"
+ LKNA Náměšť --> needed as category "ifr"
+ LKMT OSTRAVA/Mošnov --> needed as category "ifr"
+ LKPD Pardubice --> needed as category "ifr"
+ LKPR PRAHA/Ruzyně --> needed as category "ifr"
+ LKVO PRAHA/Vodochody --> needed as category "ifr"
```

### title
The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end, so e.g. instead of `LKTB BRNO/Tuřany` we want `BRNO/Tuřany LKTB`.

### icao
The ICAO Code is the 4 letter sign on the airports, e.g. `LKTB` in `LKTB BRNO/Tuřany`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the airport charts. To have to see it, you have to expand a airport (with the '+' sign). Then you have to find the `href` / URL of the section that contains the word "Charts Related" in the title, e.g. `AD 2.24 LKTB CHARTS RELATED TO THE AERODROME`

### country
As already mentioned, the country code (two letter) **for Czech is "CZ"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
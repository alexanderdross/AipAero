# Python Crawler for Greece

## Goal

Your goal is to extract the airports of Greece. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "military" or lastly "aerodrome" if it not specified which type)
- Country Code (two letter), **for Greece use "GR"**

## Implementation

1. You create a new file for your crawler in `crawlers/`. 
2. You create a class and you **must inherit the base class `CrawlerBase`** with the `self.crawl()` method
3. You implement the `self.crawl()` method using **Selenium Headless** 
4. You send the airports via the `self.write_to_output(airports)` method from the CrawlerBase class. Nothing to implement for you here.
5. You call your crawler in `main.py`.

## Output

You store your extracted airports in a list of `Airport` objects:

```python
class Airport(BaseModel):
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "military", "aerodrome"] = Field(alias="type")
    country: str
```

Then you just call the `self.write_to_output(airports)` method with these results.

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
The titles you see are the `title` are almost the correct ones. We want the ICAO code at the end, so e.g. instead of `LFBA AGEN LA GARENNE` we want `AGEN LA GARENNE LFBA`.

### icao
The ICAO Code is the 4 letter sign on the airports, e.g. `LFBA` in `LFBA AGEN LA GARENNE`. **It can be None, if nothing is specified.**

### url
The URL we want is the URL for the airport charts. To have to see it, you have to expand a airport (with the '+' sign). Then you have to find the `href` / URL of the section that contains the word "Cartes relatives" in the title, e.g. `AD 2.24 LFBA  Cartes relatives à l'aérodrome`.

### country
As already mentioned, the country code (two letter) **for Greece is "GR"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
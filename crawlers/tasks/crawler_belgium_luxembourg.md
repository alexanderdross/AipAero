# Python Crawler for Belgium and Luxembourg Airports

## Goal

Your goal is to extract the airports of Belgium and Luxembourg. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "military" or lastly "aerodrome" if it not specified which type)
- Country Code (two letter), **for belgium and luxembourg use "BE"**

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
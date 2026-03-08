# Python Crawler for Czech Airports

## Goal

Your goal is to extract the airports of Czech. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "military" or lastly "aerodrome" if it not specified which type)
- Country Code (two letter), **for Czech use "CZ"**

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
As already mentioned, the country code (two letter) **for belgium and luxembourg is "CZ"**.

## Verification
Please send me the print statement from the output handler, so that I can check if everything is correct.
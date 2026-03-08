# Python Crawler for Denmark

## Goal

Your goal is to extract the airports of Denmark. The information of one airport to be extracted contains the following parts:

- ICAO Code (4 letters)
- Title
- URL to the airport charts
- Airport Type ("vfr", "ifr", "heliport", "military" or lastly "aerodrome" if it not specified which type)
- Country Code (two letter), **for Denmark use "DK"**

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
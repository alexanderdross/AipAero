# PDF recon - SI (Slovenia)

Source: GitHub Actions run 29273393673 ("Crawler live test", job 86896428531), `pdf_recon` step, 2026-07-13 (inputs: countries=SI, pdf_recon=true, gen12=SI). Same recon mechanics as `pdf-recon-batch1.md`: for the first 3 airports the recon fetches the chart page and lists every `<a href*=".pdf">` (first 12 shown per field).

Note: the first attempt (run 29272675868) failed all recon fetches with `CERTIFICATE_VERIFY_FAILED` - this is the rerun after the recon clients learned to trust the pinned RapidSSL intermediate (`RapidSSLTLSRSACAG1.crt.pem`, same fix the SI crawler uses via `use_extra_ca`).

Crawl: OK, 4 airports (LJLJ, LJMB, LJPZ, LJCE). Verbatim:

```
   pdf_url coverage: 0/4
   charts lists: 0/4 (0 charts total)
```

(Expected - `FETCH_PDF_URLS` is not yet enabled for SI.)

## SI - Slovenia (aim.sloveniacontrol.si) - VIABLE (positional numbering, like PT)

30/31/16 pdf links on the three sampled fields. Filenames are `LJ_AD_2_<ICAO>_<NN>-<n>[_en].pdf` where `<NN>` is the AD 2.24 chart number (01 = Aerodrome Chart by eurocontrol convention; higher numbers are IAC/VAC/etc.) - exactly the PT scheme (`pdf-recon-batch1.md`, `pt.py`). Anchor text is the relative href itself (e.g. `[../graphics/eAIP/LJ_AD_2_LJLJ_01-1_en.pdf]`), so href matching is the mechanism. Note a few links lack the `_en` suffix (LJLJ `03-1.pdf`, `04-1.pdf`), but `01-1` carries `_en` on all three sampled fields.

Per-airport counts and heads (verbatim recon output):

```
   --- recon LJLJ: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJLJ-en-GB.html#LJLJ-AD-
       30 pdf link(s)
       [../graphics/eAIP/LJ_AD_2_LJLJ_01-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_01-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_02-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_02-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_02-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_02-3_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_03-1.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_03-1.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_04-1.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_04-1.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_06-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_06-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-2_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-2_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-3_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-4_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-4_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-5_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-5_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJLJ_08-6_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJLJ_08-6_en.pdf
   --- recon LJMB: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJMB-en-GB.html#LJMB-AD-
       31 pdf link(s)
       [../graphics/eAIP/LJ_AD_2_LJMB_01-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_01-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_02-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_02-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_03-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_03-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_04-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_04-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-2_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-2_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-3_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-4_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-4_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-5_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-5_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-6_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-6_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-7_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-7_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJMB_08-8_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJMB_08-8_en.pdf
   --- recon LJPZ: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJPZ-en-GB.html#LJPZ-AD-
       16 pdf link(s)
       [../graphics/eAIP/LJ_AD_2_LJPZ_01-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_01-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_03-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_03-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_04-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_04-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_08-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_08-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_08-2_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_08-2_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_08-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_08-3_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_08-4_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_08-4_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_10-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_10-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_10-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_10-3_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_10-4_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_10-4_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_12-1_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_12-1_en.pdf
       [../graphics/eAIP/LJ_AD_2_LJPZ_12-3_en.pdf] https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/graphics/eAIP/LJ_AD_2_LJPZ_12-3_en.pdf
```

(LJCE was not recon'd - the recon samples only the first 3 airports.)

### Proposed PDF_HREF_PRIORITY

`_01-1_en.pdf` is present on all three sampled fields and, per the AD 2.24 positional convention (same reasoning as `pt.py`, which shipped `PDF_HREF_PRIORITY = (r"_01-1_en\.pdf$",)` on the identical scheme), chart 01 is the Aerodrome Chart:

```python
FETCH_PDF_URLS = True
PDF_HREF_PRIORITY = (r"_01-1_en\.pdf$",)
```

No VAC pattern can be proposed yet: the filenames carry no chart-type token (`VAC`/`ADC`), only positional numbers, and which `<NN>` is the visual approach chart is not verifiable from hrefs alone (LJPZ's `10-x` / `12-x` are candidates; LJLJ/LJMB show `08-x` blocks that are most likely IAC series). Per convention (see `hu.py` `PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$")` and `ee.py`), a VAC-number pattern may be added IN FRONT of the ADC pattern only after opening one of the numbered PDFs and verifying its chart title.

# PDF recon - batch 1 (EE FI ES LV IS PT HU)

Source: GitHub Actions run 29264498572 ("Crawler live test", job 86866101807), `pdf_recon` step, 2026-07-13.
For each country the recon fetched the first 3 airports' chart pages and listed every `<a href*=".pdf">` (falling back to `object`/`embed`/`iframe`/`img` sources when no anchors were found). Link texts are shown in `[...]`; an empty `[]` means the anchor has no text (image-only link), so `PDF_HREF_PRIORITY` (match on href) is the only viable mechanism there.

Crawl counts (all OK): EE 8, FI 40, ES 51, LV 12, IS 106, PT 19, HU 8. `pdf_url coverage` was `0/N` everywhere (expected - `FETCH_PDF_URLS` is not yet enabled for these crawlers).

Reference for the regex style: `crawlers/crawlers/cz.py` (`PDF_HREF_PRIORITY = (r"-vfrc\.pdf$", r"-adc\.pdf$")`), `se.py` (`PDF_HREF_PRIORITY = (r"VAC\.pdf$",)`), `no.py` (`PDF_TEXT_PRIORITY = (r"AD 2 \w{4} 2 - 1$",)`).

## EE - Estonia (eaip.eans.ee) - VIABLE

10-14 pdf links per airport. Filenames carry standard eurocontrol chart-type codes: `ADC` (aerodrome chart), `APDC` (parking/docking), `AOC_A` (obstacle), `IAC_<rwy>_<n>` (instrument approach), `VAC` (visual approach chart), `LDG` (landing chart), plus `FASDB` / `BIRD` extras. Anchor texts are EMPTY (except one `PPR_2024.pdf`), so use `PDF_HREF_PRIORITY`.

Representative URLs (verbatim):

- `https://eaip.eans.ee/2026-07-09/graphics/eAIP/AIRAC-AMDT-06-2026/AD_2_EEKA_VAC_en.pdf`
- `https://eaip.eans.ee/2026-07-09/graphics/eAIP/AIRAC-AMDT-03-2026/AD_2_EEKA_ADC_en.pdf`
- `https://eaip.eans.ee/2026-07-09/graphics/eAIP/AIRAC-AMDT-06-2026/AD_2_EEKE_VAC_en.pdf`
- `https://eaip.eans.ee/2026-07-09/graphics/eAIP/AIRAC-AMDT-04-2026/AD_2_EEEI_IAC_06_1_en.pdf`

Per-airport counts: EEEI 14 (ADC, APDC, AOC_A, 8x IAC - military field, no VAC), EEKA 10 (ADC x2, AOC_A, IAC x2, FASDB x2, VAC, LDG, BIRD), EEKE 10 (ADC, AOC_A, IAC x4, FASDB x2, VAC, LDG).

Proposed patterns:

```python
FETCH_PDF_URLS = True
PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$", r"_LDG_en\.pdf$")
```

Note: EEKA lists `_ADC_en.pdf` twice under two different AIRAC-AMDT folders (07-2026 and 03-2026); first match in document order should be preferred but both resolve.

## FI - Finland (www.ais.fi) - NOT VIABLE from the AD 2 page alone

Only 2 pdf links per airport, and neither is an approach/aerodrome chart: `WPT_LIST` (waypoint list) and `FAS_DB` (final approach segment data block). Identical for all 3 sampled airports (EFET, EFHA, EFHK - EFHK is Helsinki-Vantaa, which certainly has charts, so the charts are NOT anchor-linked on the AD 2 HTML page).

Representative URLs (verbatim):

- `https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFET/EF_AD_2_EFET_WPT_LIST.pdf`
- `https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFHK/EF_AD_2_EFHK_FAS_DB.pdf`

The per-airport chart folder `.../documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/` clearly exists; the chart PDFs themselves are presumably reached via the AD 2.24 chart-index links that this recon's anchor scan did not surface (possibly JS-built or in a separate chart-list page). Needs a second, deeper recon (fetch the AD 2.24 section / chart index of one field and list what it references) before enabling `FETCH_PDF_URLS` for FI. Do not guess folder contents - VERIFIED patterns only.

## ES - Spain (aip.enaire.es) - NOT VIABLE yet (0-1 links, iframe only)

- LECO: 1 pdf, and only via the `<iframe>` fallback (no anchor): `https://aip.enaire.es/AIP/contenido_AIP/AD/AD2/LECO/LE_AD_2_LECO_FICHA/LE_AD_2_LECO_FICHA_perfil.pdf#toolbar=0& navpanes=0&scrollb` (a "FICHA perfil" runway-profile sheet, not an approach chart)
- LEAB: `0 pdf link(s)`
- LEAL: `0 pdf link(s)`

ES chart PDFs sit behind further navigation on the ENAIRE AD 2 pages (chart links are not plain `.pdf` anchors in the fetched HTML). A country-specific recon of the ENAIRE chart section is required; no regex can be proposed from this run.

## LV - Latvia (ais.lgs.lv) - VIABLE (positional numbering, no chart-type code)

2-8 pdf links per airport. Filenames are `<serial>_<ICAO>_2_24_<chartNo>[_<qualifier>]_<yyyymmdd>.pdf` - i.e. keyed to the AD 2.24 chart index position, not a chart-type code. Anchor text equals the filename stem, so href and text matching are equivalent; href is more robust.

Representative URLs (verbatim):

- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/graphics/eAIP/1616_EVAD_2_24_1_20250710.pdf`
- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/graphics/eAIP/1564_EVAD_2_24_14_20250710.pdf`
- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/graphics/eAIP/1638_EVGA_2_24_1_20250904.pdf`
- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/graphics/eAIP/1578_EVGA_2_24_13_RWY18_ILS_LOC_20250710.pdf`

Per-airport: EVAD 3 (24_1, 24_14, 24_17), EVCA 2 (24_1, 24_14), EVGA 8 (24_1, 24_2, 5x 24_13 IAC variants `RWY18_ILS_LOC` / `RWY18_RNP` / `RWY18_VORTAC` / `RWY36_RNP` / `RWY36_VORTAC`, 24_14). Chart `_2_24_1_` is the first chart of section AD 2.24 (by convention the Aerodrome Chart); IAC variants carry `_2_24_13_RWY...`. Which number is the VAC (14? 17?) should be confirmed by opening one `24_14` PDF before shipping, but `24_1` as primary is safe.

Proposed patterns:

```python
FETCH_PDF_URLS = True
PDF_HREF_PRIORITY = (r"_2_24_1_\d{8}\.pdf$", r"_2_24_14_\d{8}\.pdf$")
```

## IS - Iceland (eaip.isavia.is) - WEAK (most fields 0 links)

- BIAR (sampled twice - the IS crawler emitted BIAR as two rows, `BIAR | BIAR` and `BIAR | AKUREYRI - AKUREYRI 8 BIAR`; dedupe worth checking): 3 pdfs, all specialist charts:
  - `https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_LEAD_IN_LIGHTS_RWY_01.pdf`
  - `https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_MIL_TACAN_RWY_01.pdf`
  - `https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_MIL_TACAN_RWY_19.pdf`
- BIBD: `0 pdf link(s)`

Same WePub layout as FI (`documents/Root_WePub/Rep_ISAVIA/Charts/AD/<ICAO>/PART_8/...`), and like FI the mainline ADC/IAC/VAC charts are not anchor-linked on the sampled pages (only lead-in-lights and MIL TACAN surfaced on BIAR). With 106 crawled entries and most being small VFR strips, expect 0 links for the majority. Needs a deeper recon of the chart index before proposing a pattern; no regex proposed from this run.

## PT - Portugal (ais.nav.pt) - VIABLE (positional numbering)

3-12 pdf links per airport. Filenames are `LP_AD_2_<ICAO>_<NN>-<n>_en.pdf` where `<NN>` is the AD 2.24 chart number (01 = Aerodrome Chart by eurocontrol convention; higher numbers are IAC/VAC/etc.). Anchor text is the relative href itself (e.g. `[../graphics/eAIP/LP_AD_2_LPBJ_01-1_en.pdf]`), so href matching is the natural choice.

Representative URLs (verbatim):

- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/graphics/eAIP/LP_AD_2_LPBJ_01-1_en.pdf`
- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/graphics/eAIP/LP_AD_2_LPCS_01-1_en.pdf`
- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/graphics/eAIP/LP_AD_2_LPCS_12-1_en.pdf`
- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/graphics/eAIP/LP_AD_2_LPCR_13-1_en.pdf`

Per-airport: LPBJ 3 (01-1, 11-1, 13-1), LPCS 12 (01-1, 02-1, 02-3, 02-5, 08-1, 08-3, 08-5, 08-9, 10-1, 12-1, 12-3, 13-1), LPCR 7 (01-1, 08-1, 08-3, 10-1, 10-3, 12-1, 13-1). `01-1` (present on all three) is the aerodrome chart; which `<NN>` is the VAC should be confirmed by opening one PDF (12 or 13 are candidates - both appear on all three fields).

Proposed patterns:

```python
FETCH_PDF_URLS = True
PDF_HREF_PRIORITY = (r"_01-1_en\.pdf$",)
```

(Add a VAC-number pattern in front once the number is verified.)

## HU - Hungary (ais-en.hungarocontrol.hu) - VIABLE (best of the batch)

10-38 pdf links per airport, with explicit chart-type codes in the filename: `ADC`, `AOCA`, `SID`, `STAR`, `NDB`, `RNP`, `ILS_OR_LOC`, `VAC`, `PDC`, `TAXI_ARR`/`TAXI_DEP`. Most anchors carry the relative href as text; LHBP also has named anchors like `[AD 2-LHBP-PDC/1]`.

Representative URLs (verbatim):

- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/graphics/eAIP/LH_AD_2_LHBC_VAC_en.pdf`
- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/graphics/eAIP/LH_AD_2_LHBC_ADC_en.pdf`
- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/graphics/eAIP/LH_AD_2_LHDC_VAC_en.pdf`
- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/graphics/eAIP/LH_AD_2_LHBP_ADC_en.pdf`

Per-airport: LHBC 10 (incl. VAC + ADC), LHBP 38 (ADC, TAXI, PDC x4 ... - big international field), LHDC 10 (incl. VAC + ADC).

Proposed patterns:

```python
FETCH_PDF_URLS = True
PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$")
```

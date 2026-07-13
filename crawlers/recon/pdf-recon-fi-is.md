# Chart-PDF recon - FI (ais.fi) and IS (eaip.isavia.is)

Source: GitHub Actions run 29274747730 ("Crawler live test", job 86900957481), "Crawl live sources (no publish)" step with `countries: FI IS`, `pdf_recon: true`, 2026-07-13. This run exercises the recon's new "chart-ish" diagnostic: when an AD 2 page anchors ZERO PDFs, the recon lists links whose href/text smell like a chart index or chart section (`chart|kartta|kort|VAC|ADC|2.24|WePub|Charts`, up to 10 unique, `~[text] url` lines). Note the diagnostic's gating: it only fires at 0 pdf links - pages that anchor ANY pdf (even non-chart data PDFs) never print their chart-ish candidates.

## FI - Finland (www.ais.fi) - 40 airports, pdf_url coverage 0/40

### Raw output (verbatim, recon part)

```
   pdf_url coverage: 0/40
   charts lists: 0/40 (0 charts total)
   --- recon EFET: https://www.ais.fi/eaip/currently_effective/eAIP/EF-AD 2 EFET - ENONTEKIÖ 15-en-GB.html#AD-2-EFET---ENONTEKIÖ-
       2 pdf link(s)
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFET/EF_AD_2_EFET_WPT_LIST.pdf
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFET/EF_AD_2_EFET_FAS_DB.pdf
   --- recon EFHA: https://www.ais.fi/eaip/currently_effective/eAIP/EF-AD 2 EFHA - HALLI 15-en-GB.html#AD-2-EFHA---HALLI-15
       2 pdf link(s)
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFHA/EF_AD_2_EFHA_WPT_LIST.pdf
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFHA/EF_AD_2_EFHA_FAS_DB.pdf
   --- recon EFHK: https://www.ais.fi/eaip/currently_effective/eAIP/EF-AD 2 EFHK - HELSINKI-VANTAA 15-en-GB.html#AD-2-EFHK---HELS
       2 pdf link(s)
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFHK/EF_AD_2_EFHK_WPT_LIST.pdf
       [] https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/EFHK/EF_AD_2_EFHK_FAS_DB.pdf
```

### Reading + next hop

- Every sampled AD 2 page (EFET, EFHA, EFHK) anchors exactly 2 PDFs: `EF_AD_2_<ICAO>_WPT_LIST.pdf` and `EF_AD_2_<ICAO>_FAS_DB.pdf` under `.../documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/`. These are waypoint-list / FAS-datablock data PDFs, NOT approach charts - a `PDF_TEXT_PRIORITY`/`PDF_HREF_PRIORITY` regex would only ever capture these two, so do NOT enable `FETCH_PDF_URLS` for FI against this markup.
- The **chart-ish diagnostic never fired for FI** (it is gated on 0 pdf links, and these pages have 2), so this run shows no candidate chart-index links for FI - absence of evidence, not evidence of absence.
- The two anchored PDFs prove the chart repository layout: `https://www.ais.fi/eaip/currently_effective/documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/` is where per-airport chart PDFs live. The most promising navigation hop is whatever the AD 2 page's AD 2.24 section ("Charts related to the aerodrome") references into that directory.
- **Proposed next hop for FI**: rerun the recon with the chart-ish listing ungated (always print candidates, not only at 0 PDFs) against the same AD 2 pages, focusing on the `2.24` section - the eurocontrol AD 2.24 chart table on ais.fi evidently does not use plain `.pdf` anchors on these pages (or the sampled small fields carry no charts), so we need to see what element type the chart rows use (JS viewer links, relative hrefs without `.pdf`, or `object`/`iframe` embeds). Only after that markup is visible can `FETCH_PDF_URLS` patterns be written. Until then: no verified chart-PDF extraction path exists for FI.

## IS - Iceland (eaip.isavia.is) - 53 airports, pdf_url coverage 0/53

### Raw output (verbatim, recon part)

```
   pdf_url coverage: 0/53
   charts lists: 0/53 (0 charts total)
   --- recon BIAR: https://eaip.isavia.is/A_06-2026_2026_06_11/eAIP/BI-AD BIAR AKUREYRI - AKUREYRI 8-en-GB.html#AD-BIAR-AKUREYRI-
       3 pdf link(s)
       [] https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_LEAD_IN_LIGHTS_RWY_01.pdf
       [] https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_MIL_TACAN_RWY_01.pdf
       [] https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/BIAR_8_MIL_TACAN_RWY_19.pdf
   --- recon BIBD: https://eaip.isavia.is/A_06-2026_2026_06_11/eAIP/BI-AD BIBD BÍLDUDALUR - BILDUDALUR 8-en-GB.html#AD-BIBD-BÍLDU
       0 pdf link(s)
       0 chart-ish link(s)
   --- recon BIEG: https://eaip.isavia.is/A_06-2026_2026_06_11/eAIP/BI-AD BIEG EGILSSTAÐIR - EGILSSTADIR 8-en-GB.html#AD-BIEG-EGI
       0 pdf link(s)
       0 chart-ish link(s)
```

### Reading + next hop

- BIAR (Akureyri) anchors 3 PDFs under `.../documents/Root_WePub/Rep_ISAVIA/Charts/AD/BIAR/PART_8/` - all ancillary (lead-in lights, MIL TACAN), not the mainline approach/aerodrome charts. BIBD and BIEG anchor **zero** PDFs, and the new chart-ish diagnostic fired and found **0 chart-ish link(s)** on both - the AD pages carry no anchor whose href OR text matches `chart|kort|VAC|ADC|2.24|WePub|Charts` at all. So on IS the per-airport AD page is a dead end for chart navigation on small fields: there is no deeper chart page linked from it.
- The BIAR URLs again prove the repository layout: `https://eaip.isavia.is/A_06-2026_2026_06_11/documents/Root_WePub/Rep_ISAVIA/Charts/AD/<ICAO>/PART_8/` (edition-prefixed - the `A_06-2026_2026_06_11` segment changes per AIRAC, so any captured URL is edition-specific; the crawler already resolves the current edition from `https://eaip.isavia.is/`).
- **Proposed next hop for IS**: the chart lists most likely live in the eAIP menu/TOC rather than the AD page body - the crawler already fetches `.../eAIP/menu.html`; rerun recon dumping the menu subtree under each AD entry (eurocontrol menus usually nest `AD 2.24`-style chart leaf nodes per airport) and, in parallel, one fetch of the BIAR AD page WITHOUT the recon's pdf-gate to list ALL of its anchors, to confirm whether mainline charts (e.g. `BIAR_8_ADC.pdf`-style names) are simply absent from the page or hidden behind non-matching link text. If the menu also carries nothing beyond what the AD page anchors, then Isavia publishes mainline charts only inside the per-airport PDFs/AD document itself and **no chart-PDF extraction path exists for IS small fields**; BIAR-class fields would get at most ancillary-chart PDFs, which are not `pdf_url` material.

## Bottom line

Neither country is ready for `FETCH_PDF_URLS`: FI anchors only WPT_LIST/FAS_DB data PDFs (charts presumably in the un-inspected AD 2.24 markup), IS anchors ancillary charts on its biggest field and nothing at all on small fields, with zero chart-ish candidate links. Both need one more recon iteration (ungated chart-ish listing + menu subtree dump) before any per-country pattern can be written.

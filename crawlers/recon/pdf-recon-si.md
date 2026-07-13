# PDF recon - SI (Slovenia)

Source: GitHub Actions run 29272675868 ("Crawler live test", job 86894006510), `pdf_recon` step, 2026-07-13 (inputs: countries=SI, pdf_recon=true, gen12=SI). Same recon mechanics as `pdf-recon-batch1.md`: for the first 3 airports the recon fetches the chart page and lists every `<a href*=".pdf">`.

Crawl: OK, 4 airports (LJLJ, LJMB, LJPZ, LJCE). Verbatim:

```
   pdf_url coverage: 0/4
   charts lists: 0/4 (0 charts total)
```

(Expected - `FETCH_PDF_URLS` is not yet enabled for SI.)

## SI - Slovenia (aim.sloveniacontrol.si) - RECON FAILED (TLS), no link data captured

Verbatim recon output:

```
   --- recon LJLJ: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJLJ-en-GB.html#LJLJ-AD-
       recon failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   --- recon LJMB: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJMB-en-GB.html#LJMB-AD-
       recon failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   --- recon LJPZ: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJPZ-en-GB.html#LJPZ-AD-
       recon failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
```

Zero pdf links were listed for any of the 3 fields - the failure is at the TLS handshake, before any HTML was fetched.

### Root cause

Known broken server chain on `aim.sloveniacontrol.si` (wrong RapidSSL intermediate; `crawlers/recon/probe-si.md`). The SI crawler fixes it with `use_extra_ca("https://cacerts.digicert.com/RapidSSLTLSRSACAG1.crt.pem")` and crawled fine in the same run (`SI: TLS trust extended with RapidSSLTLSRSACAG1.crt.pem`). The `pdf_recon` block in `crawler-live-test.yml` deliberately builds a FRESH `httpx.Client` ("crawl() closes the crawler's own client") with the default trust store, so it cannot complete the chain.

### Proposed PDF_HREF_PRIORITY

Not viable from this run - no URLs were captured, and per convention (see `crawlers/crawlers/hu.py` `PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$")` and `ee.py` `PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$", r"_LDG_en\.pdf$")`) only patterns supported by quoted live URLs may be proposed. Do NOT enable `FETCH_PDF_URLS` for SI yet.

If the eAIP follows the standard eurocontrol layout (as EE/HU do), VAC/ADC chart PDFs are likely to exist under `.../2026-07-09-AIRAC/graphics/...`, but that is an assumption, not evidence.

### Action to get the data

Make the `pdf_recon` step's `recon_client` trust the pinned RapidSSL intermediate (mirror the crawler's `use_extra_ca` - fetch the PEM and add it to the client's SSL context; never `verify=False`), or reuse a client derived from the crawler class before `crawl()` closes it. Then rerun `crawler-live-test.yml` with `countries: SI, pdf_recon: true` and fill this file with the verbatim per-airport pdf link lists and a supported `PDF_HREF_PRIORITY` tuple (VAC first, then ADC).

# GEN 1.2 / AD 1.3 customs recon - SI (Slovenia)

Source: GitHub Actions run 29272675868 ("Crawler live test", job 86894006510), GEN 1.2 recon step, 2026-07-13 (inputs: countries=SI, pdf_recon=true, gen12=SI). Quotes are VERBATIM from the recon output. Conventions as in `gen12-batch1.md`: in AD 1.3, `INTL` = designated for international traffic (customs available/arrangeable), `NTL` = national only; entries seed `src/lib/customs-overrides.ts` only after eyeballing the cited live page.

## SI - Slovenia - FAILED (TLS - recon client lacks the pinned RapidSSL intermediate)

Verbatim recon output (the entire GEN 1.2 SI section):

```
===== GEN 1.2 SI =====
   GEN-1.2 (en-GB) failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   GEN 1.2 (en-GB) failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   GEN-1.2: no candidate URL worked
   AD-1.3 (en-GB) failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   AD 1.3 (en-GB) failed: ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   AD-1.3: no candidate URL worked
```

No page was fetched, so NO GEN 1.2 / AD 1.3 table rows or TXT lines were captured - there is no customs data in this run to quote.

### Root cause

The failure is the known broken server chain on `aim.sloveniacontrol.si` (see `crawlers/recon/probe-si.md` and the header comment in `crawlers/crawlers/si.py`): the host sends the wrong RapidSSL intermediate. The SI crawler itself fixes this via `use_extra_ca(CA_PEM_URL)` (`http_base.py:126`, pinned public intermediate `https://cacerts.digicert.com/RapidSSLTLSRSACAG1.crt.pem` - verification stays fully enabled, never `verify=False`), and the crawl step in the SAME run succeeded:

```
INFO crawlers.http_base: SI: TLS trust extended with RapidSSLTLSRSACAG1.crt.pem
INFO crawlers.http_base: Found 4 airports for SI.
```

The GEN 1.2 recon step in `crawler-live-test.yml`, however, builds its OWN plain `httpx.Client` (BROWSER_HEADERS only, default trust store) and never gets the extended trust, so every candidate URL it constructed from the crawl's detail URLs failed at the TLS handshake. The candidates it derived (generic eurocontrol recon: sibling section files next to the AD-2 chapter files) were:

- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-GEN-1.2-en-GB.html`
- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-GEN 1.2-en-GB.html`
- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-1.3-en-GB.html`
- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD 1.3-en-GB.html`

### Fields in scope (from the crawl step of the same run, verbatim)

```
   LJLJ | LJUBLJANA/BRNIK LJLJ -> https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJLJ-en-GB.htm
   LJMB | MARIBOR/OREHOVA VAS LJMB -> https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJMB-en-GB.htm
   LJPZ | PORTOROZ/SECOVLJE LJPZ -> https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJPZ-en-GB.htm
   LJCE | CERKLJE OB KRKI LJCE -> https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-2.LJCE-en-GB.htm
```

### Candidate ICAO -> designation pairs

NONE from this run - no INTL/NTL rows were captured, and per project policy no unverified customs entries may be added to `customs-overrides.ts` (a wrong customs answer is a compliance hazard). Do not seed anything for SI yet.

### Action to get the data

Fix the live-test recon clients (both the GEN 1.2 step's `client` and the `pdf_recon` block's `recon_client` in `.github/workflows/crawler-live-test.yml`) to extend TLS trust the same way the crawler does - e.g. reuse the crawler's own client (`crawler.fetch`, which already has the extended trust after `crawl()`), or download the pinned `RapidSSLTLSRSACAG1.crt.pem` into the SSL context; never `verify=False`. Then rerun `crawler-live-test.yml` with `gen12: SI` and fill this file with the verbatim GEN 1.2 / AD 1.3 rows.

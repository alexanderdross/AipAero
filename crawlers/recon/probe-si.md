# SI eAIP probe - aim.sloveniacontrol.si

Source: GitHub Actions run 29264498572 ("Crawler live test", job 86866101807), "Probe candidate eAIP roots" step, 2026-07-13. Probe env: `PROBE: https://aim.sloveniacontrol.si/aim/sl/products/`.

## Raw output (verbatim, complete)

```
===== PROBE https://aim.sloveniacontrol.si/aim/sl/products/ =====
   FAILED - ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
```

## What was (and was not) captured

- Status: none - the TLS handshake failed before any HTTP request was sent.
- Title: none.
- Meta-refresh / frames: none.
- Links: none.

## Classification

INCONCLUSIVE - no eurocontrol-style eAIP entry URL could be identified in this run, because the probe never reached the server. The failure is `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate`, i.e. the runner's Python trust store could not build the chain for `aim.sloveniacontrol.si`. The most common cause for this exact error is a server that does not send its intermediate CA certificate (browsers work around it via AIA fetching / cached intermediates; httpx/OpenSSL does not). It can also mean a locally-trusted-only or expired chain - indistinguishable from this output.

## A SI crawler's ROOT_URL

Cannot be determined from this run. Next steps, in order:

1. Re-run the probe with the missing intermediate supplied explicitly (do NOT disable verification): download the site's chain (`openssl s_client -connect aim.sloveniacontrol.si:443 -showcerts`), identify the missing intermediate, and pass a `verify=` SSL context that includes it, or point the probe at a combined CA bundle. If the chain turns out to be genuinely broken server-side, an `httpx.Client(verify=<custom ctx>)` with the pinned intermediate is the acceptable crawler-side fix (crawler runs on the self-hosted runner only).
2. Re-probe `https://aim.sloveniacontrol.si/aim/sl/products/` plus the likely English/eAIP variants once TLS works - only then classify whether a eurocontrol frameset (`index-sl-SI.html` / `eAISNavigation`) exists and fix ROOT_URL.
3. Until then, SI stays unclassified: no `ROOT_URL`, no base-class choice (HttpEurocontrolBase vs bespoke) can be justified from data.

## Re-Probe with TLS diagnosis (run 29270333630)

Source: GitHub Actions run 29270333630 ("Crawler live test", job 86886144870), "Probe candidate eAIP roots" step, 2026-07-13. The probe now runs `openssl s_client` in three variants (default / legacy / `-cipher DEFAULT@SECLEVEL=1`) after an httpx failure.

### Raw output (verbatim, complete)

```
===== PROBE https://aim.sloveniacontrol.si/aim/sl/products/ =====
   FAILED - ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)
   [tls default] exit 0
     0 s:CN = *.sloveniacontrol.si
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = RapidSSL TLS RSA CA G1
     1 s:C = US, O = "DigiCert, Inc.", CN = RapidSSL Global TLS RSA4096 SHA256 2022 CA1
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
     Verification error: unable to verify the first certificate
     New, TLSv1.2, Cipher is ECDHE-RSA-AES256-GCM-SHA384
     verify error:num=20:unable to get local issuer certificate
     verify return:1
     verify error:num=21:unable to verify the first certificate
     verify return:1
     verify return:1
   [tls legacy] exit 0
     0 s:CN = *.sloveniacontrol.si
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = RapidSSL TLS RSA CA G1
     1 s:C = US, O = "DigiCert, Inc.", CN = RapidSSL Global TLS RSA4096 SHA256 2022 CA1
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
     Verification error: unable to verify the first certificate
     New, TLSv1.2, Cipher is ECDHE-RSA-AES256-GCM-SHA384
     verify error:num=20:unable to get local issuer certificate
     verify return:1
     verify error:num=21:unable to verify the first certificate
     verify return:1
     verify return:1
   [tls seclevel1] exit 0
     0 s:CN = *.sloveniacontrol.si
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = RapidSSL TLS RSA CA G1
     1 s:C = US, O = "DigiCert, Inc.", CN = RapidSSL Global TLS RSA4096 SHA256 2022 CA1
     i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
     Verification error: unable to verify the first certificate
     New, TLSv1.2, Cipher is ECDHE-RSA-AES256-GCM-SHA384
     verify error:num=20:unable to get local issuer certificate
     verify return:1
     verify error:num=21:unable to verify the first certificate
     verify return:1
     verify return:1
```

### Conclusion

The hypothesis from the first probe is confirmed and now precisely diagnosed as a **server-side misconfigured chain: the server sends the WRONG intermediate certificate**.

- The leaf (depth 0) is `CN = *.sloveniacontrol.si`, issued by **`CN = RapidSSL TLS RSA CA G1`**.
- The only intermediate the server sends (depth 1) is **`CN = RapidSSL Global TLS RSA4096 SHA256 2022 CA1`** (issued by `DigiCert Global Root CA`) - a different CA that did NOT sign the leaf.
- OpenSSL therefore reports `verify error:num=20:unable to get local issuer certificate` on the leaf and `num=21:unable to verify the first certificate`: the chain from leaf to a trusted root cannot be built with what the server provides. The missing certificate is the intermediate **"RapidSSL TLS RSA CA G1"** (itself chaining to the trusted `DigiCert Global Root CA`).
- **Neither `-legacy_server_connect` nor `SECLEVEL=1` helps** - all three variants produce byte-identical output and connect fine at the protocol level (exit 0, TLSv1.2, `ECDHE-RSA-AES256-GCM-SHA384`). This is purely a trust-path problem, not a protocol/cipher problem.

What a crawler-side SSL context needs: an `httpx.Client(verify=<ssl.SSLContext>)` whose context loads the default CA bundle **plus the pinned "RapidSSL TLS RSA CA G1" intermediate** (public DigiCert cert, downloadable from DigiCert's CA repository, or extractable via AIA from the leaf). Do NOT disable verification. With that context in place, re-probe `https://aim.sloveniacontrol.si/aim/sl/products/` (and English/eAIP variants) to finally classify the SI eAIP structure and pick a ROOT_URL.

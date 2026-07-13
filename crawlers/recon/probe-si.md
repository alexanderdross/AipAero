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

# IE + BG eAIP probes - iaip.iaa.ie and b-flip.bulatsa.com

Source: GitHub Actions run 29270333630 ("Crawler live test", job 86886144870), "Probe candidate eAIP roots" step, 2026-07-13. Probe env: `PROBE: https://aim.sloveniacontrol.si/aim/sl/products/ https://iaip.iaa.ie/ https://b-flip.bulatsa.com/` (SI is documented in `probe-si.md`). Each httpx failure is followed by `openssl s_client` in three variants (default / legacy / `-cipher DEFAULT@SECLEVEL=1`); entry pages with no links and no frames are re-tried with a Playwright (headless Chromium) render (`[render]` lines).

## IE - iaip.iaa.ie

### Raw output (verbatim, complete)

```
===== PROBE https://iaip.iaa.ie/ =====
   FAILED - ConnectError: [SSL: SSLV3_ALERT_HANDSHAKE_FAILURE] ssl/tls alert handshake failure (_ssl.c:1010)
   [tls default] exit 1
     Verification: OK
     New, (NONE), Cipher is (NONE)
     4027B9A30A7C0000:error:0A000410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:../ssl/record/rec_layer_s3.c:1599:SSL alert number 40
   [tls legacy] exit 1
     Verification: OK
     New, (NONE), Cipher is (NONE)
     4057422998740000:error:0A000410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:../ssl/record/rec_layer_s3.c:1599:SSL alert number 40
   [tls seclevel1] exit 1
     Verification: OK
     New, (NONE), Cipher is (NONE)
     403768F955700000:error:0A000410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:../ssl/record/rec_layer_s3.c:1599:SSL alert number 40
```

### Conclusion

This is NOT a certificate/trust problem - it is the **server aborting the handshake itself**. In all three openssl variants the server answers the ClientHello with a fatal **`SSL alert number 40` (handshake_failure)** before any certificate is exchanged (`Cipher is (NONE)`, no chain printed; the `Verification: OK` line is vacuous because nothing was verified). Neither `-legacy_server_connect` nor `DEFAULT@SECLEVEL=1` changes anything, so the failure is not the modern-client security level either. Alert 40 at this stage means the server found nothing acceptable in the offered ClientHello - typically it requires a legacy protocol/cipher combination that even SECLEVEL=1 does not re-enable (e.g. TLS 1.0/1.1 only, or a specific legacy cipher), or it rejects based on some other ClientHello property (SNI/extensions).

What an httpx/ssl workaround needs: a custom `ssl.SSLContext` that goes further than SECLEVEL=1 - lower `minimum_version` to `ssl.TLSVersion.TLSv1` and set a wide legacy cipher string (e.g. `ctx.set_ciphers("DEFAULT@SECLEVEL=0")` or an explicit legacy list), passed as `httpx.Client(verify=ctx)`; if OpenSSL 3 on the runner still refuses (legacy provider needed for the oldest ciphers) or the server also filters on client fingerprint, fall back to a Playwright fetch (Chromium negotiates its own TLS stack) or the Bright Data proxy/unlocker path via `use_proxy()`. Until one of these succeeds, no IE eAIP entry URL can be identified - the probe never got an HTTP byte back.

## BG - b-flip.bulatsa.com

### Raw output (verbatim, complete)

```
===== PROBE https://b-flip.bulatsa.com/ =====
   200 https://b-flip.bulatsa.com/
   title: B-FLIP
   (0 interesting links total)
   [render] title: Sign in to BULATSA Flight Information Portal (B-FLIP v.2)
     (0 interesting links total)
```

### Conclusion

The plain httpx fetch succeeds (HTTP 200, title `B-FLIP`) but the served HTML is an empty client-rendered shell (0 links, no frames), so the probe escalated to the Playwright render. The rendered DOM's title is **"Sign in to BULATSA Flight Information Portal (B-FLIP v.2)"** with **0 interesting links** - i.e. after JS rendering the entry page is a **login wall**, exposing no navigation at all to an anonymous client.

**No eAIP entry URL is identifiable from this run - there are no candidate URLs to quote** (the rendered DOM exposed zero links). A `PlaywrightCrawlerBase` crawler pointed at `https://b-flip.bulatsa.com/` would only ever see the sign-in page; rendering alone does not get past authentication. Next steps: determine whether B-FLIP offers anonymous/guest access behind a different path (e.g. a public eAIP deep link that skips the portal login), or whether BULATSA publishes the eAIP on another public host entirely - and only if a session-free public URL exists does a Playwright crawler become viable. Credential-based login is a separate policy decision, not a recon outcome.

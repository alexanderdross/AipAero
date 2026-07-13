# SK + LT eAIP probes - aim.lps.sk and www.ans.lt

Source: GitHub Actions run 29274747730 ("Crawler live test", job 86900957481), "Probe candidate eAIP roots" step, 2026-07-13. Probe env: `PROBE: https://iaip.iaa.ie/ https://aim.lps.sk/ https://www.ans.lt/` (IE is documented in `probe-ie-bg.md`). This run exercises the probe's new 403 handling: an HTTP 403 is retried once through the Bright Data plain proxy (`BRIGHTDATA_PROXY_URL`, `[proxy-retry]` line).

## SK - aim.lps.sk

### Raw output (verbatim, complete)

```
===== PROBE https://aim.lps.sk/ =====
   403 https://aim.lps.sk/
   FAILED - HTTP 403
   [proxy-retry] via brd.superproxy.io:33335
   403 https://aim.lps.sk/
   FAILED - HTTP 403
```

### Classification

**NO - the Bright Data plain proxy does NOT unlock aim.lps.sk.** The direct browser-headers request gets HTTP 403, and the `[proxy-retry]` through `brd.superproxy.io:33335` gets the identical HTTP 403 - so the block is not (only) IP-based; the server is rejecting the client fingerprint or the request shape itself, exactly the class of block the plain proxy cannot clear. No title, no links, no frames were ever received. **No eurocontrol eAIP entry URL was identified for SK** - the probe never got past the front door. Next escalation per the crawler playbook: the Bright Data Web Unlocker zone (`BRIGHTDATA_UNLOCKER_URL`, the GR path - it solves fingerprint/captcha gates the plain proxy cannot) and/or a Playwright render; only if one of those returns HTML can an eAIP root be looked for.

## LT - www.ans.lt

### Raw output (verbatim, complete)

```
===== PROBE https://www.ans.lt/ =====
   403 https://www.ans.lt/
   FAILED - HTTP 403
   [proxy-retry] via brd.superproxy.io:33335
   403 https://www.ans.lt/
   FAILED - HTTP 403
```

### Classification

**NO - the Bright Data plain proxy does NOT unlock www.ans.lt either.** Same pattern as SK: direct 403, `[proxy-retry]` via `brd.superproxy.io:33335`, retry 403. Not IP-based (or not only IP-based); the plain proxy changes the exit IP but not the client fingerprint. **No eurocontrol eAIP entry URL was identified for LT.** Same next escalation as SK: Web Unlocker (`BRIGHTDATA_UNLOCKER_URL`) or Playwright render; note the LT eAIP may also live on a dedicated host reachable without the WAF'd corporate site (worth probing candidate roots like an `eaip`/`ais` subdomain in a future run before spending unlocker traffic).

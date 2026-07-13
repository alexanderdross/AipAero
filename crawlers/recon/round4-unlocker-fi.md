# Runde 4: Web-Unlocker-Eskalation IE/SK/LT + FI-Chart-Hints

Run 29278021225 (crawler-live-test.yml, self-hosted Runner, 13.07.2026,
Head afd6d75; Inputs: `countries: FI`, `pdf_recon: true`,
`probe_eaip: https://iaip.iaa.ie/ https://aim.lps.sk/ https://www.ans.lt/`).
Verbatim-Auszüge aus dem Job-Log.

## IE (iaip.iaa.ie) - ALLE Wege scheitern, auch der Unlocker

```
===== PROBE https://iaip.iaa.ie/ =====
   FAILED - ConnectError: [SSL: SSLV3_ALERT_HANDSHAKE_FAILURE] ssl/tls alert handshake failure (_ssl.c:1010)
   [tls default] exit 1   (Verification: OK, Cipher is (NONE), SSL alert number 40)
   [tls legacy] exit 1    (identisch)
   [tls seclevel1] exit 1 (identisch)
   [tls-retry] rebuilding client: legacy
   FAILED - ConnectError: [SSL: SSLV3_ALERT_HANDSHAKE_FAILURE]
   [tls-retry] exhausted - trying Chromium
   [render] failed: Error: Page.goto: net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH
   [unlocker] via brd.superproxy.io:33335
   [unlocker] 502 https://iaip.iaa.ie/
   [unlocker] FAILED - HTTPStatusError: Server error '502 Navigation failed'
```

Der Server bricht JEDEN Handshake mit Alert 40 ab, bevor überhaupt eine
Cipher ausgehandelt ist - openssl (default/legacy/SECLEVEL=1), httpx,
Chromium UND der Bright-Data-Unlocker-Browser. Das ist kein
Cipher-Problem unsererseits mehr: wahrscheinlich Client-Zertifikat,
IP-Allowlist oder Geo-Gate. GEPARKT - nur ein anderer IAA-Host oder
eine Owner-Recherche (funktioniert die Seite im Browser aus DE?) hilft
weiter.

## SK (aim.lps.sk) - Origin lehnt auch den Unlocker ab

```
===== PROBE https://aim.lps.sk/ =====
   403 https://aim.lps.sk/          (plain)
   [proxy-retry] 403                (Bright-Data-Plain-Proxy)
   [unlocker] 502 https://aim.lps.sk/
   [unlocker] FAILED - HTTPStatusError: Server error '502 response status was rejected'
```

TLS ist in Ordnung, die Sperre ist HTTP-Level (WAF) und trifft auch die
Unlocker-Exit-IPs ("response status was rejected" = der Origin gab dem
Unlocker selbst einen abgelehnten Status). GEPARKT - nächster sinnvoller
Versuch ist eine TIEFERE URL (die Root könnte härter gefiltert sein als
der eAIP-Pfad) oder eine andere lps.sk-Subdomain.

## LT (www.ans.lt) - Unlocker funktioniert, aber Root ohne eAIP-Links

```
===== PROBE https://www.ans.lt/ =====
   403 (plain), 403 (proxy-retry)
   [unlocker] 200 https://www.ans.lt/
   [unlocker] title: AB Oro navigacija
     link [Asmens duomenų apsauga] https://www.ans.lt/lt/bendrove/asmens-duomenu-apsauga
     (1 interesting links total)
```

Der Web-Unlocker holt echtes HTML (200, ANSP-Homepage). Der einzige
Link-Treffer ist ein False Positive ("duomenu" matcht "menu") - die
Root verlinkt keinen eAIP-Einstieg. NÄCHSTER SCHRITT: direkte
eAIP-Kandidaten-URLs via Unlocker proben (z.B. `/en/aip`,
Subdomain-Kandidaten); der Zugang selbst ist gelöst.

## FI pdf_recon (Gate <= 2 PDFs, Chart-Hint-Regex)

40 Airports gecrawlt (Fallback `index.html`, da `index-en-GB.html`
404). Recon EFET/EFHA/EFHK: jede AD-2-Seite verlinkt per `<a>` EXAKT
zwei Daten-PDFs (leerer Anchor-Text), auch EFHK:

```
[] .../documents/Root_WePub/ANSFI/Charts/AD/EFHK/EF_AD_2_EFHK_WPT_LIST.pdf
[] .../documents/Root_WePub/ANSFI/Charts/AD/EFHK/EF_AD_2_EFHK_FAS_DB.pdf
```

Die Chart-Hint-Liste fand KEINE weiteren Links - die eigentlichen
Karten (ADC/VAC/Approach) sind auf der AD-2-Seite nicht anchor-verlinkt.
Erkenntnis: das per-ICAO-Verzeichnis
`documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/EF_AD_2_<ICAO>_<CHART>.pdf`
ist die FI-Namenskonvention; die Karten der AD-2.24-Tabelle referenziert
die Seite anders (kein `<a href>`). Nächster Recon-Hop: das rohe Markup
der AD-2.24-Sektion einer FI-Seite dumpen (embed/object/JS?) - erst
danach lohnt ein Extraktions-Versuch. `pdf_url coverage: 0/40` bleibt
bis dahin korrekt.

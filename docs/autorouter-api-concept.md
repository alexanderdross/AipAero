# autorouter API: NOTAMs (+ GRAMET) auf den Detailseiten - Konzept

Owner-Auftrag 13.07.2026: "macht es Sinn, https://www.autorouter.aero/wiki/api/
zu verwenden, für GRAMET und NOTAMs?" Dieses Dokument ist der Plan; gebaut
wird erst nach Phase 0 (Verifikation). Verwandt: der autorouter-DEEP-LINK
wurde am 13.07.2026 entfernt (Soft-404, siehe `src/lib/efb-links.ts`).

## Kurzbewertung

- **NOTAMs: ja, hoher Wert.** Das einzige Briefing-Datum, das den
  Detailseiten komplett fehlt (Wetter, Facts, Sunrise/Sunset existieren).
  autorouter ist der einzige unserer Hand-off-Partner mit dokumentierter,
  kostenloser API, die NOTAMs pro ICAO liefert. Kein anderer freier,
  EU-weiter NOTAM-Zugang mit klaren Bedingungen bekannt (die FAA-API deckt
  Europa nur teilweise; EAD ist lizenzpflichtig).
- **Begriffsklärung GRAMET vs. GAMET** (Owner-Rückfrage 13.07.2026;
  "GARMET" existiert nicht):
  - **GRAMET** = grafisches ROUTEN-Meteogramm (Ogimet-basiert,
    Wetterquerschnitt entlang eines Flugwegs). Das bietet autorouter an.
  - **GAMET** = textuelle GEBIETS-Vorhersage für Flüge in niedrigen
    Höhen (ICAO Annex 3), herausgegeben von den nationalen Wetterdiensten
    pro FIR/Teilgebiet (in DE z.B. über den DWD, oft login-/
    kostenpflichtig). NICHT dasselbe Produkt und nicht sicher Teil der
    autorouter-API - ob deren Briefing-Endpunkt GAMET mitliefert, klärt
    der Phase-0-Dump.
- **GRAMET: bedingt.** GRAMET ist ein Routen-Querschnitt - auf einer
  EINZELPLATZ-Seite gibt es keine Route; ein Punkt-Meteogramm ist ein
  anderes Produkt. Sinnvolle Optionen: (a) weglassen, (b) späteres Feature
  "Route briefen" (zwei ICAOs), das GRAMET + Strecken-NOTAMs zeigt - ein
  eigenes, größeres Produktstück. **GAMET dagegen wäre flächig einem
  Detailplatz zuordenbar** (Platz liegt in genau einem Vorhersagegebiet) -
  WENN eine freie, lizenzklare Quelle existiert; das prüft Phase 0 mit.
  Empfehlung: NOTAMs zuerst; GRAMET/GAMET nur als Phase 3 evaluieren.

## Phase 0 - Verifikation (VOR jedem Code; verified-only-Policy)

Die Sandbox erreicht autorouter nicht (Proxy bekommt 403) - alle Checks
laufen über den Runner (`crawler-live-test.yml`, `dump_url`-Input).

**Stand 13.07.2026 (Run 29285972787, dump_url der API-Wiki-Root) -
VERIFIZIERT:**

- Die API existiert und ist dokumentiert: "The autorouter web interface
  is built on top of a RESTful API exporting the complete autorouter
  functionality. This application programming interface (API) is also
  available to 3rd party applications."
- Basis-URL: `https://api.autorouter.aero/v1.0/<group>/<request>`
  (GET/POST/PUT/DELETE, JSON; Statuscodes 200/400/401/403/404/500
  dokumentiert).
- Entitäten laut Doku: Users, Aircraft, Routes, Flightplans, Navdata,
  **Weather, Briefing, Documents, NOTAMs** - NOTAMs haben eine eigene
  Doku-Seite (`/wiki/api/notams`), ebenso Authentication
  (`/wiki/api/authentication/` - "Authentication via OAuth 2.0";
  Session-Cookies gelten laut Doku als "not practical for API users").
  GRAMET wird auf der Root-Seite NICHT erwähnt (ggf. unter Weather/
  Briefing - klärt der nächste Dump).
- Nebenbefund: `/airport/EDNY` ist server-seitig KEINE 404, sondern eine
  reine JS-Shell ("Please enable JavaScript to continue using this
  application.") - client-seitig zeigt das Routing dann "not found"
  (Owner-Screenshot). Der entfernte Deep-Link bleibt draußen.

**Stand 13.07.2026, Runde 2 (Run 29286529102, dump_url der vier
Unterseiten) - ENDPUNKTE VERIFIZIERT:**

- **NOTAM-Suche** (genau unser Anwendungsfall, KEIN Route-Objekt nötig):
  `GET https://api.autorouter.aero/v1.0/notam?itemas=["EDDS"]&offset=0&limit=10`
  - `itemas` = JSON-Array von Item-A-Kennungen (ICAO-Airport ODER FIR),
    `offset`/`limit` (max 100), `startvalidity`/`endvalidity`
    (Unix-Sekunden). Response `{total, rows[]}` mit u.a. `iteme`
    (NOTAM-Text), `itema`, `code23`/`code45` (Q-Code-Teile), `fir`,
    `endvalidity`, `modified`, `lat`/`lon` (Garmin-Format, mal
    `90 / 2^30`), `lower`/... - reicht für Kategorie-Badge, Gültigkeit
    und Klartext.
  - Datenquelle laut Doku: **Eurocontrol EAD / INO** - "the only
    authoritative and trustworthy source of European NOTAMs". Für
    Europa also BESSER als die FAA-Quelle.
- **Auth**: OAuth 2.0 **client_credentials** - `POST
  https://api.autorouter.aero/v1.0/oauth2/token` mit
  `grant_type=client_credentials`, `client_id` = Account-E-Mail,
  `client_secret` = Passwort; Access-Token ~1 h gültig (Token im
  Incremental Cache mit TTL < 1 h wiederverwenden). WICHTIG: "your
  account with autorouter has to be configured to allow for API access.
  Please request this permission via the support ticket function" -
  Owner-Schritt, siehe unten.
- **METAR/TAF**: `GET /v1.0/met/metartaf/<icao>` (null wenn keine
  Station) - möglicher Fallback/Vergleich zu AWC, kein Muss.
- **GRAMET**: doch einzeln verfügbar - `GET /v1.0/met/gramet` mit `fpl`
  (ICAO-FPL-String) ODER `waypoints` + `departuretime` + `totaleet` +
  `altitude`; `format=pdf|png`; synchron, liefert eine Datei. Bleibt
  ROUTE-basiert (braucht Wegpunkte + Zeiten) → bestätigt Phase 3
  ("Route briefen"). **GAMET existiert in der API nicht** (Briefing-Items
  decken sigwx/mslp/temsi ab, kein GAMET).
- **Briefing-Pack** (`GET /v1.0/flightplan/<routeid>/briefing?...`, 19
  Items inkl. `notam` + `gramet`, sync PDF oder non-blocking POST +
  Poll-Token): braucht ein Route-Objekt - für die Detailseiten
  irrelevant, relevant erst für ein Route-Feature.
- **Terms/Limits**: kein explizites Rate-Limit dokumentiert (nur
  `limit` max 100 + 1-h-Token); Footer verweist auf "autorouter AG
  Terms and Conditions". Attributionspflicht nicht in der API-Doku
  erwähnt.

**Noch offen (Owner):**

1. **API-Freischaltung per Support-Ticket beantragen** (dabei direkt
   die Nutzung auf aip.aero ansprechen - klärt Terms/Attribution in
   einem Schritt).
2. Danach: Test-Call vom Runner (Token + 1x NOTAM-Abruf EDDF/EDNY,
   Latenz + Payload notieren) - dann kann Phase 1 starten.

Abbruchkriterien: Terms verbieten Weiterveröffentlichung; Freischaltung
wird nicht erteilt; Rate-Limits unter ~1 req/s.

## Architektur (Workers/Next.js Best Practices)

Gleiches Muster wie das Wetter (`src/lib/weather.ts`) - server-seitig,
gecacht, fail-soft:

- **`src/lib/autorouter.ts`**: Fetch-Client. OAuth2 client_credentials
  (verifiziert): `client_id` = Account-E-Mail, `client_secret` =
  Passwort als Worker-Secrets `AUTOROUTER_USER`/`AUTOROUTER_PASSWORD`
  (in `src/env.js` validiert, `.env.example` + `.dev.vars.example`
  ergänzt). Das ACCESS-TOKEN (~1 h) wird über den OpenNext Incremental
  Cache wiederverwendet (TTL ~50 min), damit nicht jeder Seitenaufruf
  den Token-Endpunkt trifft.
- **`src/lib/notam-parse.ts`**: purer, dependency-freier Parser/Mapper
  (Q-Code-Kategorie, Gültigkeitsfenster von/bis, Text) - unit-testbar wie
  `openaip-parse.ts` / `metar-decode.ts`.
- **Caching: ZWEISTUFIG - Incremental Cache + D1-Persistenz (Owner-Vorgabe
  13.07.2026).** Lesepfad pro ICAO:
  1. `unstable_cache` (OpenNext Incremental Cache, TTL ~15 min) - fängt
     die Masse der Requests ab, kein D1-/Upstream-Roundtrip.
  2. Cache-Miss → D1-Tabelle `aip_aero_v4_notam_cache` lesen
     (`icao` PK, `payload` JSON, `fetched_at`): Zeile frischer als
     15 min → direkt servieren (kein Upstream-Call).
  3. Erst dann autorouter fetchen (5 s Timeout) und die Zeile
     upserten - Writes damit auf max. 1 pro ICAO pro 15 min begrenzt
     (kein Request-Path-Schreibsturm; D1-Batch nicht nötig, Einzelzeile).
  4. **Upstream-Fehler → letzte D1-Zeile MIT `fetched_at`-Zeitstempel
     servieren** ("Stand: 14:32z") - Luftfahrt-Regel: datiert stale ist
     ok, stillschweigend stale nie. Nur ohne jede Zeile rendert die Box
     nichts (fail-soft).
  Warum D1 zusätzlich zum Cache: überlebt Deploys und Tag-/Cache-Busts,
  entkoppelt uns von autorouter-Ausfällen und -Rate-Limits (Schutz der
  Partner-API UND unserer p95-Latenz: D1-Read in Millisekunden statt
  Upstream-Roundtrip), und der Bestand ist abfragbar (Monitoring,
  künftige Features). Migration via `pnpm db:generate` (Drizzle,
  `aip_aero_v4_`-Präfix). NIE im Service Worker cachen (wie
  `/api/airport-weather`: kein staler Sicherheitsinhalt offline).
- **UI `src/components/airport-notams.tsx`**: SSR-Box im Gadgets-Wrapper
  (vierte Box neben Kontakt/Wetter/Daten), lazy/Suspense wie die Wetterbox
  und innerhalb der bestehenden `min-h`-Reserve (CLS-Regel). Anzeige:
  Kategorie-Badge, Gültigkeit, Klartext; Roh-NOTAM in `<details>` (kein
  Client-JS). Immer mit Abrufzeitstempel (Luftfahrt-Regel: nie stillschweigend
  stale) + Attribution "via autorouter" falls gefordert.
- **Fail-soft**: kein Token / Timeout (5 s) / Fehler → Box rendert nichts.
  Kein neues Error-1102-Risiko: eine Upstream-Anfrage pro Cache-Miss,
  gestreamt außerhalb des kritischen Pfads.
- **SEO + Web-Performance first (Owner-Vorgabe - die Detailseiten sind
  der Traffic-Treiber):** NOTAMs sind flüchtig → NICHT in Metadaten
  oder JSON-LD, kein eigener Index-Content (Duplicate-/Thin-Content-
  Risiko), reine Nutzwert-Box UNTERHALB des indexierbaren Inhalts. Kein
  Beitrag zum kritischen Renderpfad: die Box streamt hinter Suspense
  innerhalb der bestehenden `min-h`-Reserve des Gadgets-Wrappers (kein
  CLS, kein TTFB-Aufschlag auf den SEO-Content), null Client-JS (SSR +
  `<details>` für Roh-NOTAMs). Dank D1-Stufe trifft die große Mehrheit
  der Requests nie den Upstream - p95 bleibt auf heutigem Niveau.
- **Terms-of-Service-Seite aktualisieren (Owner-Vorgabe, Teil von
  Phase 2):** autorouter wird als eingebundene Datenquelle im
  Quellen-Abschnitt der Terms ergänzt - ein Eintrag im code-seitigen
  Quellen-Array (`src/app/[locale]/terms/page.tsx`, Muster srcAwc/
  srcOpenAip) + neuer i18n-Key `TermsPage.srcAutorouter` in allen 38
  Locale-Dateien ("NOTAMs via autorouter / Eurocontrol EAD"), plus
  etwaige von autorouter geforderte Attribution aus der
  Ticket-Antwort.

## Phasen

| Phase | Inhalt | Gate |
| --- | --- | --- |
| 0 | dump_url-Recon der API-Doku (ERLEDIGT), API-Freischaltung + Terms per Support-Ticket (Owner), Test-Call vom Runner | Freischaltung + Terms erlauben die Nutzung |
| 1 | `autorouter.ts` (Auth+Fetch) + `notam-parse.ts` + D1-Tabelle `aip_aero_v4_notam_cache` (Migration) + Unit-Tests | Live-Test-Lauf grün |
| 2 | NOTAM-Box hinter Env-Flag (`AUTOROUTER_USER` gesetzt = an), i18n-Keys in allen 38 Dateien, **Terms-Quelleneintrag `srcAutorouter`**, e2e unverändert grün | Owner-Review auf 2-3 Live-Plätzen |
| 3 | GRAMET-Evaluation (nur falls Route-Feature gewünscht; GAMET existiert nicht in der API) | eigenes Konzept |

## Offene Punkte (Owner)

- autorouter-Account für die API bereitstellen (Secrets setzen).
- Ggf. kurze Anfrage an autorouter zu kommerzieller Nutzung/Attribution.

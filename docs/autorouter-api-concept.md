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
laufen über den Runner (`crawler-live-test.yml`, neuer `dump_url`-Input):

1. `dump_url: https://www.autorouter.aero/wiki/api/` - API-Doku dumpen:
   Endpunkte (NOTAM, ggf. GRAMET), Auth-Flow, Response-Format.
2. Nutzungsbedingungen + Attributionspflichten aus der Doku zitieren und in
   dieses Dokument übernehmen. Unklar → Owner fragt beim Betreiber an
   (autorouter ist ein kleines Team; eine kurze Mail klärt kommerzielle
   Nutzung auf einer werbefinanzierten Seite).
3. Test-Call vom Runner mit einem Owner-Account-Token: 1x Token holen, 1x
   NOTAM-Abruf für EDDF/EDNY, Latenz + Payload-Größe notieren.

Abbruchkriterien: Terms verbieten Weiterveröffentlichung; kein
account-loser Server-zu-Server-Flow möglich; Rate-Limits unter ~1 req/s.

## Architektur (Workers/Next.js Best Practices)

Gleiches Muster wie das Wetter (`src/lib/weather.ts`) - server-seitig,
gecacht, fail-soft:

- **`src/lib/autorouter.ts`**: Fetch-Client. OAuth2-Token (Credentials als
  Worker-Secrets `AUTOROUTER_USER`/`AUTOROUTER_PASSWORD` bzw. Client-ID/
  Secret, je nach Doku; in `src/env.js` validiert, `.env.example` +
  `.dev.vars.example` ergänzt). Das ACCESS-TOKEN wird über den OpenNext
  Incremental Cache wiederverwendet (TTL = Token-Lifetime minus Puffer),
  damit nicht jeder Seitenaufruf den Token-Endpunkt trifft.
- **`src/lib/notam-parse.ts`**: purer, dependency-freier Parser/Mapper
  (Q-Code-Kategorie, Gültigkeitsfenster von/bis, Text) - unit-testbar wie
  `openaip-parse.ts` / `metar-decode.ts`.
- **Caching**: NOTAMs pro ICAO ~15 min TTL (zeitkritisch - kurz, aber nicht
  pro Request; Muster Wetterbox). NIE im Service Worker cachen (wie
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
- **SEO**: NOTAMs sind flüchtig → NICHT in Metadaten oder JSON-LD, kein
  eigener Index-Content (Duplicate-/Thin-Content-Risiko), reine
  Nutzwert-Box unterhalb des indexierbaren Inhalts.

## Phasen

| Phase | Inhalt | Gate |
| --- | --- | --- |
| 0 | dump_url-Recon der API-Doku, Terms zitieren, Test-Call vom Runner | Terms erlauben die Nutzung |
| 1 | `autorouter.ts` (Auth+Fetch, gecacht) + `notam-parse.ts` + Unit-Tests | Live-Test-Lauf grün |
| 2 | NOTAM-Box hinter Env-Flag (`AUTOROUTER_USER` gesetzt = an), i18n-Keys in allen 38 Dateien, e2e unverändert grün | Owner-Review auf 2-3 Live-Plätzen |
| 3 | GRAMET-Evaluation (nur falls Route-Feature gewünscht) | eigenes Konzept |

## Offene Punkte (Owner)

- autorouter-Account für die API bereitstellen (Secrets setzen).
- Ggf. kurze Anfrage an autorouter zu kommerzieller Nutzung/Attribution.

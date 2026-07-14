# IndexNow via Bing Webmaster Tools - Konzept

Owner-Auftrag 14.07.2026: IndexNow einrichten, damit Bing (und die
IndexNow-Partner Yandex, Seznam, Naver) bei jedem Crawler-Publish sofort
erfahren, welche Seiten sich geaendert haben - statt auf den naechsten
organischen Crawl zu warten. Passt perfekt zu unserem Modell: die Inhalte
aendern sich taeglich und ereignisgetrieben (Crawler POST -> `/api/airports`),
genau der Trigger, den IndexNow braucht.

## Was IndexNow ist (kurz)

Ein offenes Protokoll: man POSTet eine Liste geaenderter URLs an einen
Endpunkt, alle teilnehmenden Suchmaschinen bekommen die Info gemeinsam.
Authentifiziert wird ueber einen oeffentlichen Schluessel, der als Textdatei
unter der eigenen Domain liegt. Kein Account-Token im Request, kein Rate-Limit
im klassischen Sinn (Bing empfiehlt <= 10.000 URLs/Tag, achtet auf Spam).

## STATUS QUO (14.07.2026)

- **Schluessel + Hosting sind erledigt:** Bing WMT hat am 14.07.2026 den Key
  `fae2b7dc9cfb44919eb6b358e7c4a846` generiert (damit in Bing registriert);
  `public/fae2b7dc9cfb44919eb6b358e7c4a846.txt` haelt ihn und wird unter
  `https://aip.aero/fae2b7dc9cfb44919eb6b358e7c4a846.txt` ausgeliefert - die
  von IndexNow geforderte Key-Verifikation. Der fruehere, nie registrierte
  Key `9f68ce9a...` wurde entfernt.
- **Was FEHLT:** die Submission. Niemand ruft den IndexNow-Endpunkt auf, wenn
  ein Crawl neue Daten publiziert. Dieses Konzept schliesst genau diese Luecke.

## Zwei Wege (Empfehlung: B, ggf. A zusaetzlich als Netz)

### Option A - Cloudflare Crawler Hints (Null Code)

Cloudflare kann IndexNow automatisch aus seinem Cache ableiten:
Dashboard -> Caching -> Configuration -> **Crawler Hints / Enable IndexNow**.
Ein Toggle, kein Code. Nachteil: cache-basiert, nicht inhalts-basiert - es
feuert, wenn Cloudflare eine Aenderung am Edge bemerkt, nicht praezise beim
Crawler-Publish, und es kennt unsere Semantik nicht (welches Land, welche
Detailseiten). Als kostenloses Sicherheitsnetz OK, aber ungenau.

### Option B - praeziser Submit beim Crawler-Publish (EMPFOHLEN)

Wir wissen exakt, wann und was sich aendert: `MUTATIONS.insertAirports`
(`src/server/db/queries.ts`) bekommt genau EIN Land pro POST, macht den
atomaren delete-then-insert und feuert danach `revalidateTag(country:XX)`.
**Direkt an dieser Stelle** submitten wir die geaenderten URLs dieses Landes
an IndexNow - dieselbe Stelle, dieselbe Praezision wie die Cache-Invalidierung.

## Architektur (Option B)

- **`src/lib/indexnow.ts`**: kleiner Client. `submitUrls(urls: string[])`
  POSTet an `https://api.indexnow.org/indexnow` (Bing akzeptiert auch
  `https://www.bing.com/indexnow`) mit JSON-Body:
  ```json
  {
    "host": "aip.aero",
    "key": "fae2b7dc9cfb44919eb6b358e7c4a846",
    "keyLocation": "https://aip.aero/fae2b7dc9cfb44919eb6b358e7c4a846.txt",
    "urlList": ["https://aip.aero/de/", "..."]
  }
  ```
  Der Schluessel ist **kein Secret** (per Design oeffentlich), also ein
  einfacher `var` in `wrangler.jsonc` (`INDEXNOW_KEY`) + `.env.example` +
  `src/env.js` `server`-Block, nicht `wrangler secret put`. Ohne den Var
  faellt der Client still aus (fail-soft, kein Fehler).
- **Hook**: in `insertAirports` NACH dem erfolgreichen Batch + `revalidateTag`.
  Der Submit darf die Crawler-Antwort NICHT blockieren: auf Workers via
  `getCloudflareContext().ctx.waitUntil(submitUrls(...))` feuern - der POST
  laeuft, nachdem die 201 an den Crawler raus ist. Vollstaendig fail-soft
  (Timeout 5 s, Fehler nur geloggt).
- **Welche URLs pro Crawl (Phase 1, niedrig-volumig):** die Seiten, die sich
  bei jedem Crawl SICHTBAR aendern (Stand-Datum, ggf. neue/entfallene
  Plaetze) - pro Land also 2-4 URLs:
  - Country-Landing nativ + EN: `/xx/`, `/xx/en/`
  - Airport-Liste nativ + EN (lokalisierte Slugs via `getPathname`)
  Das sind ~4 URLs pro Land pro Tag, ueber 19 Laender ~80/Tag - weit unter
  jedem Limit. Detailseiten aendern ihren Inhalt taeglich kaum (gleicher
  Chart-Link), deshalb hier bewusst NICHT pauschal alle ~1.000 mitsenden
  (Spam-Signal, unnoetig).
- **Detailseiten (Phase 2, GEBAUT 14.07.2026, diff-basiert):** `insertAirports`
  liest die vorhandenen (type, slug) VOR dem atomaren Delete
  (`existingKeys`, `snapshotOk`), vergleicht mit der neuen Liste und uebergibt
  `submitCountryToIndexNow` die NEU hinzugekommenen + WEGGEFALLENEN Plaetze als
  `changedDetails`. Deren Detail-URLs (nativ + EN, im Sitemap-Schema
  `${path}?${slug}`) landen im selben Ping. `snapshotOk=false` (Snapshot-Read
  fehlgeschlagen) unterdrueckt den Detail-Ping, damit ein transienter Fehler
  nie das ganze Land flutet; ein echter Erst-Publish (leerer Snapshot) sendet
  bewusst alle Detailseiten EINMAL (deckt den Neues-Land-Launch mit ab).

## Neues-Land-Launch (Ergaenzung)

Beim Launch eines Landes (liveCountries-Flip + Erst-Publish) will man EINMAL
alle URLs des neuen Landes gesammelt anstossen. Der Erst-Publish-Crawl feuert
ohnehin `insertAirports` -> Phase-1-Submit deckt Landing + Liste ab. Fuer die
frischen Detailseiten: ein optionaler CD-Schritt (analog zur Warm-up-Liste)
oder ein Phase-2-Voll-Submit des neuen Landes. Der Sitemap-Index
(`/2d6a9a/sitemap.xml`) selbst wird NICHT via IndexNow gemeldet - IndexNow
meldet Inhalts-URLs, nicht Sitemaps; die Sitemap-Einreichung bleibt Sache der
Bing/Google Webmaster Tools.

## Owner-Schritte (Bing Webmaster Tools)

1. **Site verifizieren** (falls noch nicht): bing.com/webmasters -> aip.aero
   hinzufuegen. Am einfachsten per Import aus der Google Search Console (Bing
   bietet das direkt an), sonst DNS-/Meta-/XML-Verifikation.
2. **IndexNow-Key** (ERLEDIGT 14.07.2026): in Bing WMT generiert
   (`fae2b7dc9cfb44919eb6b358e7c4a846`), Key-Datei in `public/` gehostet.
   Der `INDEXNOW_KEY`-Var (Phase 1) muss auf denselben Wert gesetzt werden.
3. **Sitemap einreichen:** WMT -> Sitemaps -> `https://aip.aero/2d6a9a/sitemap.xml`
   (unabhaengig von IndexNow, aber sinnvoll gleich mit).

## SEO / Web-Performance-Leitplanken

- Kein Einfluss auf den kritischen Renderpfad: der Submit ist ein reiner
  Server-zu-Server-POST hinter `waitUntil`, nach der Crawler-Antwort. Kein
  Client-JS, keine Auswirkung auf TTFB/CLS der Nutzerseiten.
- Kein neues Error-1102-Risiko: ein einzelner kleiner fetch pro Crawl-POST
  (1x pro Land pro Tag), kein Request-Path-Sturm.
- Dedup/Volumen: Phase 1 ist von Natur aus winzig; Phase 2 deckelt auf den
  Diff. Nie pauschal die ganze Country-URL-Menge taeglich senden.

## Rate-Limit-Fix (14.07.2026, nach dem ersten Live-Crawl)

Der erste echte Crawl-POST-Durchlauf (Crawl #14) hat gezeigt: `insertAirports`
feuerte den Submit fuer JEDES publizierte Land - ein voller Tages-Crawl sind
~19 Laender, und `api.indexnow.org` hat selbst bei ~20-60 s Abstand die
spaeteren Submits mit **HTTP 429 (Too Many Requests)** abgewiesen (in den
Cloudflare-Worker-Logs sichtbar: "IndexNow submit for SE/IS/HU/DK: HTTP 429").
Der Bing-WMT-Report blieb dadurch leer.

Zwei Ebenen fixen das:

- **Ebene 1 (Ursache): nur bei echter Aenderung pingen.** `insertAirports`
  ruft `submitCountryToIndexNow` jetzt NUR, wenn `changedDetails` nicht leer
  ist (ein Flugplatz kam hinzu oder fiel weg). Ein No-Op-Crawl (gleiche
  Flugplaetze, nur das Stand-Datum bewegt sich) pingt GAR NICHTS - genau die
  taegliche 19-Laender-Flut, die das Limit riss. Routinemaessige Frische traegt
  ohnehin die per-Land-Sitemap-`lastmod` (siehe unten). Ein echter Erst-Publish
  hat einen leeren Snapshot -> jeder Flugplatz zaehlt als "added" -> nicht leer
  -> pingt weiterhin.
- **Ebene 2 (Netz): 429/503 mit Jitter-Backoff wiederholen.** Ein AIRAC-Zyklus
  kann viele Laender gleichzeitig aendern; dann streut ein gejitterter Backoff
  (3-6 s, dann 6-9 s, bis zu 3 Versuche, alles im `waitUntil`-Budget) den Burst.

Ergaenzend gegen den Bing-WMT-"Sitemap veraltet"-Hinweis: die Sitemap-`lastmod`
(Index + per-Land) kommt jetzt aus dem echten Crawl-Zeitstempel
(`QUERIES.crawlUpdatedAt`, country-getaggt) statt dem Build-Datum, bewegt sich
also taeglich mit dem Crawl.

## Phasen

| Phase | Inhalt | Gate |
| --- | --- | --- |
| 0 | Key + Hosting + Bing-Registrierung (ERLEDIGT 14.07.2026) | Bing bestaetigt den Key |
| 1 | `indexnow.ts` + `INDEXNOW_KEY` var + Hook in `insertAirports` (Landing + Liste, nativ + EN, via waitUntil, fail-soft) - **GEBAUT 14.07.2026** | Live-Crawl-POST loest sichtbaren Submit aus (WMT IndexNow-Report) |
| 2 | Diff-basierte Detailseiten-Submits (neu/entfallen) - **GEBAUT 14.07.2026** | Live-Crawl mit tatsaechlichem Diff |
| 3 | Rate-Limit-Fix: Ping nur bei Diff + 429/503-Retry mit Jitter-Backoff - **GEBAUT 14.07.2026** | Voller Tages-Crawl ohne 429 im Worker-Log |

**Phase-1-Umsetzung (14.07.2026):** `src/lib/indexnow.ts`
(`submitCountryToIndexNow`), `INDEXNOW_KEY` als `var` in `wrangler.jsonc`
(Wert = Key, oeffentlich) + `src/env.js` (optional) + Example-Dateien, Hook
in `MUTATIONS.insertAirports` nach `revalidateTag` via
`ctx.waitUntil`. Verifikation offen: nach dem naechsten Deploy einen
Crawl-POST (oder `crawl.yml`) abwarten und den Bing-WMT-IndexNow-Report
pruefen; der Sandbox-Proxy erreicht `api.indexnow.org` ggf. nicht, ein
Runner-Test-Submit ist die Alternative.

## Verifikation

Nach Phase 1: Bing WMT -> IndexNow-Report zeigt eingereichte URLs und deren
Status. Ausserdem laesst sich der Client vom Runner testen (der Sandbox-Proxy
erreicht die Bing-Endpunkte ggf. nicht) - ein `dump_url`/`check_urls`-artiger
Lauf, der einmal `submitUrls` mit einer Test-URL feuert und die HTTP-Antwort
(200/202 = akzeptiert) loggt.

## Offene Punkte (Owner)

- Bing-WMT-Verifikation + Key-Eintrag (Schritt 1-2 oben).
- Entscheidung: zusaetzlich Cloudflare Crawler Hints als Netz aktivieren?
  (harmlos, aber ungenau - meine Empfehlung: erst Option B, A nur falls
  gewuenscht).

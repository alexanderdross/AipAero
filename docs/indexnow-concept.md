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

- **Schluessel + Hosting sind bereits erledigt:** `public/9f68ce9a...b.txt`
  existiert und enthaelt den Schluessel `9f68ce9a6ab6426cbcd721e1704127db`.
  Er wird als statische Datei unter
  `https://aip.aero/9f68ce9a6ab6426cbcd721e1704127db.txt` ausgeliefert - das
  ist die von IndexNow geforderte Key-Verifikation.
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
    "key": "9f68ce9a6ab6426cbcd721e1704127db",
    "keyLocation": "https://aip.aero/9f68ce9a6ab6426cbcd721e1704127db.txt",
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
- **Detailseiten (Phase 2, optional, diff-basiert):** nur URLs von Plaetzen,
  die seit dem letzten Crawl NEU hinzukamen oder WEGFIELEN, wirklich
  submitten. Der Diff muss berechnet werden: entweder in `insertAirports`
  (vorhandene ICAOs vor dem Delete lesen - ein zusaetzlicher Read) oder im
  Crawler/OutputHandler (er kennt die vorige Liste bereits ueber
  `last_run_counts.json`, muesste sie auf ICAO-Ebene erweitern). Entfallene
  Plaetze sind wichtig (Engine soll den 404 sehen). Erst bauen, wenn Phase 1
  live und verifiziert ist.

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
2. **IndexNow-Key verknuepfen:** WMT -> IndexNow. Entweder den BESTEHENDEN
   Key (`9f68ce9a...`) eintragen ODER Bing einen generieren lassen - falls
   Bing einen neuen ausgibt, ersetzen wir die Datei in `public/` und den
   `INDEXNOW_KEY`-Var entsprechend (beide muessen identisch sein). Ich
   empfehle, den bestehenden Key zu behalten und in WMT einzutragen.
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

## Phasen

| Phase | Inhalt | Gate |
| --- | --- | --- |
| 0 | Key + Hosting (ERLEDIGT); Owner: Site in Bing WMT verifizieren + Key eintragen | Bing bestaetigt den Key |
| 1 | `indexnow.ts` + `INDEXNOW_KEY` var + Hook in `insertAirports` (Landing + Liste, nativ + EN, via waitUntil, fail-soft) | Live-Crawl-POST loest sichtbaren Submit aus (WMT IndexNow-Report) |
| 2 | Diff-basierte Detailseiten-Submits (neu/entfallen) | Owner-Wunsch nach Phase-1-Verifikation |

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

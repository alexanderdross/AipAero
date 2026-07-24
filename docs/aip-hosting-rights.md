# AIP chart hosting & offline: rights checklist (per country)

**Status:** the **re-hosting/mirroring** question (below) is research-only, NOT
yet acted on. The **linking-to-gated-portals** question is being acted on -
licensing/permission outreach to gated authorities started 18.07.2026 (see
"Gated countries: linking needs permission" below).
**This is not legal advice.** It frames the question and collects the sources to
check; the final go/no-go per country is a legal decision for the owner.

## Why this matters

Today AIP:Aero is a **link directory**: it points to each authority's official
chart page and hosts **nothing** (see the site's disclaimer - "we merely provide
convenient links"). That posture is low-liability precisely because we don't
copy the charts.

The proposal - **mirror the chart PDFs to our own storage (R2), display them via
Mozilla PDF.js, and cache them offline via the PWA service worker** - is
technically attractive (solves cross-origin framing/CORS, enables offline EFB
use). But it turns us from a *linker* into a **redistributor** of third-party
copyrighted material. That is only permissible where the source's terms allow
**redistribution / re-hosting**, which is a different (and stricter) grant than
"free to view / download for operational use".

Two further obligations come with self-hosting:

- **AIRAC currency (safety/liability).** AIPs change every **28-day AIRAC
  cycle**. A locally-hosted, stale approach chart is a safety hazard. Self-hosting
  means committing to a **reliable per-cycle re-sync** and a visible "valid as of
  <AIRAC/date>" stamp on every chart. Linking to the source always yields the
  current chart for free.
- **Attribution.** Most open aeronautical data / AIP reuse grants require
  crediting the source authority; record the exact required wording per country.

## What to decide per country

For each source, the question is **not** "can I download it?" (yes, that's the
whole point of a free AIP) but: **"Do the terms permit re-hosting/redistributing
the PDFs on a third-party site?"** Answer one of:

- **YES** - redistribution permitted (note conditions: attribution, non-commercial,
  no-modification, AIRAC-currency requirement).
- **NO** - viewing/linking only → keep the direct link (Stage 1/2 of
  `docs/chart-pdf-plan.md`), do **not** mirror.
- **CONDITIONAL** - permitted with permission/agreement → contact the authority.

## Per-country checklist (to verify)

Sources are from the crawler set (see `crawlers/README.md`). Redistribution
status is **TO VERIFY** for all - fill in after reading each authority's
copyright / terms-of-use / disclaimer page.

| Country | Authority / source | AIP entry point | Redistribution | Notes / required wording |
| --- | --- | --- | --- | --- |
| Austria (AT) | Austro Control | eaip.austrocontrol.at | TO VERIFY | Check Austro Control eAIP copyright notice |
| Germany (DE) | DFS | aip.dfs.de (BasicVFR/IFR) | TO VERIFY | DFS terms; BasicVFR is free-to-view - re-host clause? |
| France (FR) | SIA / DGAC | sia.aviation-civile.gouv.fr | TO VERIFY | SIA conditions générales d'utilisation |
| Netherlands (NL) | LVNL | eaip.lvnl.nl | TO VERIFY | LVNL eAIP disclaimer |
| United Kingdom (UK) | NATS | nats-uk.ead-it.com | TO VERIFY | NATS AIS terms; Crown copyright likely |
| Belgium/Lux (BE) | skeyes | ops.skeyes.be | TO VERIFY | skeyes eAIP terms |
| Czechia (CZ) | ANS CR | aim.rlp.cz | TO VERIFY | ANS CR terms |
| Denmark (DK) | Naviair | aim.naviair.dk | TO VERIFY | Naviair terms |
| Greece (GR) | HANSP / HASP | aisgr.hasp.gov.gr | TO VERIFY | HANSP terms (note: captcha-gated) |
| Norway (NO) | Avinor | avinor.no/en/ais | TO VERIFY | Avinor AIS terms |
| Poland (PL) | PANSA | ais.pansa.pl | TO VERIFY | PANSA terms |
| Sweden (SE) | LFV | aro.lfv.se | TO VERIFY | LFV terms |

General notes:

- Many European AIPs are published under the **EUROCONTROL EAD / eAIP** framework;
  the *technical* format is shared but the *licence* is each **state's own** -
  there is no blanket EAD redistribution grant. Check per state.
- Some states publish under an **open-data / open-government licence** (which may
  allow reuse with attribution); others assert full **Crown/state copyright**
  (UK, likely FR) restricting redistribution. Verify the specific notice, not the
  general vibe.
- Where the answer is NO, the current **direct-link** approach remains the
  correct, compliant option.

## Gated countries: linking needs permission (outreach 18.07.2026)

A distinct, lighter question from re-hosting: some authorities gate the AIP
**navigation** behind a login, so even a crawler that only wants to **link** to
their charts cannot enumerate them without an account. For these countries the
site ships an **OurAirports info-page** (aerodrome list + OpenAIP data + weather
+ a link to the provider portal where the user authenticates) - never a chart
crawl. They are the `gatedCountries` set in `src/lib/utils.ts`:

`ch, mt, md, it, hr, bg, tr, az, ua, uz, by, ru, tj, tm, kg`.

Two were proven login-gated at the navigation layer on 18.07.2026 (a real-charts
crawl was attempted then reverted, PR #313 -> #314):

- **Italy (ENAV)** - `onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/`
  (`default.html` AND the dated edition folders `.../eAIP/LI-menu-en-GB.html`)
  302-redirects to **Oracle IDCS SSO**, even under a legacy-TLS handshake +
  headless render. No open static tree.
- **Bulgaria (BULATSA b-flip)** - renders a **Keycloak** login page; the
  `/_aip/AD_files/LB_AD_1_3_en.pdf` index is **403**. Chart PDFs are reachable
  only from an authenticated browser.

**Policy for gated countries:** link-only to the **current AIRAC** edition,
never host/copy/cache/redistribute; do NOT scrape behind a login and do NOT wire
in credentials (respect the access control). The compliant way to unlock charts
is a written **linking permission** or an **open data feed** from the authority
(or via **EUROCONTROL EAD**), obtained by the owner.

### Outreach status (started 18.07.2026)

Emails sent requesting a strict **link-only** permission / feed (deep-link to the
current-AIRAC files, no self-hosting). Awaiting replies:

| Target | Address | Covers |
| --- | --- | --- |
| EUROCONTROL EAD | `ead.service@eurocontrol.int` | many ECAC+ states at once (become an EAD Data User) |
| ENAV (Italy) | `customersatisfaction@enav.it` | IT |
| BULATSA (Bulgaria) | `atsainfo@bulatsa.com` | BG |
| skyguide / skybriefing (Switzerland) | `helpdesk@skybriefing.com` | CH |
| Crocontrol (Croatia) | `ais.subscription@crocontrol.hr` | HR |
| MATS (Malta) | `aim@maltats.com` | MT |
| DHMI (Turkey) | `aipgm@dhmi.gov.tr` (verify) | TR |
| MoldATSA (Moldova) | `office@moldatsa.md` (verify) | MD |

Lower priority / not contacted: RU, BY (sanctions/compliance), UA (wartime),
UZ/TJ/TM/KG (low traffic, non-ECAC; TJ/TM route via CAICA). When any authority
grants linking/a feed, build the crawler like the other real-charts countries -
linking to the current-AIRAC files, the *access* was the only blocker.

## Recommended sequence (if/when pursued)

1. **Legal review** of the table above → mark each country YES / NO / CONDITIONAL.
2. For **YES** countries only: build the mirror pipeline (crawler downloads the
   PDF → R2), the **PDF.js** viewer (same-origin, solves framing/CORS), the
   **service-worker offline cache** (selective "save for offline"), and the
   **per-cycle AIRAC re-sync** + "valid as of" stamp + attribution.
3. For **NO** countries: keep the direct link (`docs/chart-pdf-plan.md`).
4. Revisit each cycle - terms change.

## Cost / effort notes (technical, once legal is cleared)

- **Storage:** R2 (cheap, no egress fees); volume is many GB across the live roster (~50 countries),
  re-synced every 28 days.
- **Crawler:** currently refuses binary/PDF fetches on purpose (to keep metered
  Bright Data proxy traffic down - `crawlers/crawlers/http_base.py`). Mirroring
  PDFs needs a separate, non-proxied download path with its own bandwidth budget.
- **Viewer/offline:** PDF.js (client) + a service worker for selective offline
  caching (not precache-everything - browser storage quotas).

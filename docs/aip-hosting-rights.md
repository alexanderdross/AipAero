# AIP chart hosting & offline: rights checklist (per country)

**Status: research/decision doc for the future - NOT yet acted on.**
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

## Recommended sequence (if/when pursued)

1. **Legal review** of the table above → mark each country YES / NO / CONDITIONAL.
2. For **YES** countries only: build the mirror pipeline (crawler downloads the
   PDF → R2), the **PDF.js** viewer (same-origin, solves framing/CORS), the
   **service-worker offline cache** (selective "save for offline"), and the
   **per-cycle AIRAC re-sync** + "valid as of" stamp + attribution.
3. For **NO** countries: keep the direct link (`docs/chart-pdf-plan.md`).
4. Revisit each cycle - terms change.

## Cost / effort notes (technical, once legal is cleared)

- **Storage:** R2 (cheap, no egress fees); volume is many GB across 12 countries,
  re-synced every 28 days.
- **Crawler:** currently refuses binary/PDF fetches on purpose (to keep metered
  Bright Data proxy traffic down - `crawlers/crawlers/http_base.py`). Mirroring
  PDFs needs a separate, non-proxied download path with its own bandwidth budget.
- **Viewer/offline:** PDF.js (client) + a service worker for selective offline
  caching (not precache-everything - browser storage quotas).

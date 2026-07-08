# Concept: AIP:Aero → Trade:Aero cross-linking

_Dated 2026-07-08. Companion to `docs/pilot-wishlist.md`._

## Goal

Turn the single static Trade:Aero footer link into **locale- and country-aware deep links** that send
a pilot from an AIP:Aero page to the matching Trade:Aero aircraft marketplace — same language, filtered
to the same country. Trade:Aero (the sister property) covers **14 languages and 57 countries**; AIP:Aero
knows the visitor's language + country from the locale, i.e. exactly the two parameters Trade:Aero's URL
needs. The win is **UX & conversion** (pilot lands in his language + country) and **referral traffic**
between two closely related, owned properties.

> Note: this is technically **cross-domain / outbound** linking (two domains), not "internal" in the SEO
> sense — but between owned, topically-adjacent sites it's a legitimate relevance + conversion play.

## Verified Trade:Aero URL structure

- **Language = subdirectory.** English at the root; otherwise a prefix: `/de/`, `/fr/`, `/nl/`, `/es/`,
  `/it/`, `/pl/`, `/cs/`, `/sv/`, `/pt/`, `/ru/`, `/tr/`, `/el/`, `/no/`. Full list at
  <https://trade.aero/languages/> (`/de/sprachen/` etc.).
- **Localized "aircraft" slug** per language: DE `flugzeuge`, EN `aircraft`, FR `aeronefs`, NL
  `vliegtuigen`.
- **Country = query parameter** that narrows the search: `?country=<ISO-3166 alpha-2>` (e.g. `?country=DE`).

## Locale → Trade:Aero mapping (all 9 AIP:Aero locales)

AIP:Aero has only 4 languages (en/de/fr/nl) and 5 countries — all inside Trade:Aero's 14/57, so the
mapping is complete:

| AIP locale | Lang | Country | Trade:Aero deep link (before UTM) |
| --- | --- | --- | --- |
| `de` | de | DE | `https://trade.aero/de/flugzeuge/?country=DE` |
| `de-EN` | en | DE | `https://trade.aero/aircraft/?country=DE` |
| `at` | de | AT | `https://trade.aero/de/flugzeuge/?country=AT` |
| `at-EN` | en | AT | `https://trade.aero/aircraft/?country=AT` |
| `fr` | fr | FR | `https://trade.aero/fr/aeronefs/?country=FR` |
| `fr-EN` | en | FR | `https://trade.aero/aircraft/?country=FR` |
| `nl` | nl | NL | `https://trade.aero/nl/vliegtuigen/?country=NL` |
| `nl-EN` | en | NL | `https://trade.aero/aircraft/?country=NL` |
| `uk` | en | UK→**GB** | `https://trade.aero/aircraft/?country=GB` |

All links also carry `&utm_source=aip.aero&utm_medium=referral&utm_campaign=cross-link` for attribution.

The only code that isn't a straight uppercase of the AIP country code is the **United Kingdom**: AIP uses
`uk`, ISO-3166 / Trade:Aero use `GB`. It is built in via a one-line override
(`TRADE_COUNTRY_OVERRIDES` in `src/lib/trade-aero.ts`) — trivially flippable to `UK` if Trade:Aero adopts
that code when the UK is added there.

## Auto-rollout — new AIP:Aero countries get the link for free

Requirement: **when a country is added to AIP:Aero, the Trade:Aero link must roll out with it, no manual
wiring.** Two mechanisms guarantee this:

1. **URL** — `tradeAeroUrl(locale)` derives everything from the existing locale config
   (`localeLangMapping` / `localeCountryMapping`). A new locale immediately yields a correct URL. Graceful
   fallbacks: an unknown language falls back to the English listing (still country-filtered), and the
   country code defaults to the uppercased AIP code (= ISO alpha-2 for every planned country). Only add a
   `TRADE_LANG` entry when a new language's localized slug is confirmed, or a `TRADE_COUNTRY_OVERRIDES`
   entry for a genuine code mismatch.
2. **Copy** — the CTA reads the `TradeAero` message namespace, and `scripts/check-i18n.mjs` enforces that
   every locale file carries the same keys. A newly added country therefore **cannot pass CI** without its
   `TradeAero` copy — so the CTA ships automatically with the country.

## Placement (implemented)

- **A) Footer link (sitewide)** — the existing `tradeaero` footer link now points to `tradeAeroUrl(locale)`
  instead of the static `https://trade.aero`.
- **B) Contextual CTA box** — a localized `TradeAeroCta` (server-rendered) on the **country landing page**
  (`[locale]/page.tsx`) and the **airport-list page**, e.g. _"Flugzeug in Deutschland kaufen oder
  verkaufen? → Flugzeuge in Deutschland ansehen"_. Country-specific, varied anchor text — far more valuable
  than a repeated boilerplate footer link, with clear conversion intent.
- (C) An airport-detail CTA under the chart button is a natural later add-on, not yet built.

## Link behaviour

The Trade:Aero links are **followed** — `rel="noopener"` (not `nofollow`/`noreferrer`) via a new optional
`rel` prop on `ExternalLink` — so the link passes topical relevance and Trade:Aero receives the referrer.
All other outbound links keep the default `noopener noreferrer nofollow`. UTM params add analytics
attribution.

### SEO & accessibility

- **`title` + `aria-label`** on every link (both set to `hrefTitle` by `ExternalLink`); the trailing
  external-link icon is `aria-hidden`.
- **Descriptive, country-specific anchor text** (e.g. "View aircraft in Germany") — good for SEO and
  screen-reader users, never "click here".
- **WCAG 2.5.3 Label in Name**: the CTA's `buttonHrefTitle` (its accessible name) **begins with the
  visible `buttonTitle`**, then adds context — so the accessible name contains the visible label
  (e.g. visible "View aircraft in Germany" → aria-label "View aircraft in Germany on Trade:Aero — buy and
  sell aircraft"). Keep this prefix relationship when editing the `TradeAero` copy for new locales.

## Launch-plan synergy — which countries to add next

When choosing the next AIP:Aero countries (from the `crawlers/tasks/` backlog and the EUROCONTROL AIS
index, see `docs/pilot-wishlist.md` §D.1), **prioritize the countries with the strongest Trade:Aero
presence** so both properties reinforce each other: every new AIP:Aero country immediately gains a
Trade:Aero cross-link (and vice-versa the marketplace gets qualified, country-matched referral traffic).
Trade:Aero already spans 57 countries, so the practical filter is **listing volume / market activity per
country**, not mere presence — lead with the busiest aircraft markets (e.g. DE/FR/UK/ES/IT/PL) that also
have a tractable eAIP to crawl.

## Files

- `src/lib/trade-aero.ts` — the `tradeAeroUrl(locale)` builder (single source of truth).
- `src/components/trade-aero-cta.tsx` — the localized CTA box (SSR).
- `src/components/external-link.tsx` — optional `rel` prop.
- `src/components/footer.tsx` — footer link → locale-aware deep link.
- `src/app/[locale]/page.tsx`, `src/app/[locale]/airport-list/page.tsx` — render the CTA.
- `messages/*.json` — the `TradeAero` namespace (all 9 locales).

## Open follow-ups

- Confirm the UK country code on Trade:Aero once the UK goes live there (expected `GB`; one-line change).
- Add `TRADE_LANG` slugs for further languages (it/es/pl/cs/sv/pt/ru/tr/el/no) as AIP:Aero expands into
  those locales — until then those locales correctly fall back to the English listing.

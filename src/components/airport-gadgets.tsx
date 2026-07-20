import pick from "lodash/pick";
import { FlagIcon } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AirportAipText } from "~/components/airport-aip-text";
import { AirportChart } from "~/components/airport-chart";
import { AirportContact } from "~/components/airport-contact";
import { AirportFacts } from "~/components/airport-facts";
import { AirportNearby } from "~/components/airport-nearby";
import { AirportRunwayDiagram } from "~/components/airport-runway-diagram";
import { AirportWeatherWindLazy } from "~/components/airport-weather-wind-lazy";
import { RecentTracker } from "~/components/recent-tracker";
import { SchemaAirport } from "~/components/schemas/schema-airport";
import { SaveOfflineButton } from "~/components/save-offline-button";
import { SchemaDigitalDocument } from "~/components/schemas/schema-digital-document";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { localeLangMapping } from "~/i18n/routing";
import { aerodromeTypeLabel } from "~/lib/aerodrome-type";
import { getAirportFacts } from "~/lib/airport-facts";
import { buildAirportSummary } from "~/lib/airport-summary";
import { contactUrlFor } from "~/lib/contact-link";
import { forwardGeocode, reverseGeocode } from "~/lib/geocode";
import { getHubLinks } from "~/lib/hub-links";
import { toOpeningHoursSpecification } from "~/lib/opening-hours";
import { parseOsmHours } from "~/lib/osm-hours";
import { airacDateFromUrl, parseCharts } from "~/lib/charts";
import { isGatedCountry, isPdfUrl, isSelfServicePdfCountry } from "~/lib/utils";
import { after } from "next/server";
import { MUTATIONS, QUERIES } from "~/server/db/queries";
import type { Airport } from "~/server/db/schema";

// Cap for the OCR AIP text placed in the Airport JSON-LD - bounds inline
// JSON-LD growth on big fields (the full text stays in the visible block).
const OCR_JSONLD_MAX = 4000;

/** Truncate to ~OCR_JSONLD_MAX chars on a word boundary, with a trailing "…". */
function truncateForJsonLd(text: string): string {
  if (text.length <= OCR_JSONLD_MAX) return text;
  const cut = text.slice(0, OCR_JSONLD_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (
    lastSpace > OCR_JSONLD_MAX - 200 ? cut.slice(0, lastSpace) : cut
  ).trimEnd();
  return `${trimmed} …`;
}

/**
 * Extra gadgets on an airport detail page, below the chart link. Split by SEO
 * value / cost:
 *
 * - **Server-rendered (indexable):** the location box (address, coordinates,
 *   phone, website, Google Maps) and the aerodrome-data box (elevation, runways,
 *   surface, frequencies, opening hours, sun times), plus the "nearby airfields"
 *   list. One `getAirportFacts` fetch feeds these AND the enriched Airport JSON-LD
 *   (geo / elevation / postal address), so the structured data matches the boxes.
 * - **Lazy (client-side):** the ephemeral weather + wind boxes, fetched from
 *   `/api/airport-weather` after the document streams (see `AirportWeatherWind`) -
 *   so the document closes quickly instead of holding the stream open for NOAA
 *   (the long-held stream is what Lighthouse scored as document/LCP latency).
 *
 * All fail-soft. `mt-24` clears the absolutely-positioned chart link.
 */
export async function AirportGadgets({
  airport,
  schemaName,
  schemaAlternateName,
  schemaDescription,
  schemaUrl,
  related = [],
}: {
  airport: Airport;
  schemaName: string;
  schemaAlternateName: string;
  schemaDescription: string;
  schemaUrl: string;
  /** Cross-type sibling pages of the same field ("also available as IFR"). */
  related?: { type: string; url: string; label: string; title: string }[];
}) {
  const [locale, messages, facts, tCommon, tSummary, tFooter] =
    await Promise.all([
      getLocale(),
      getMessages(),
      getAirportFacts(airport.icao),
      getTranslations("Common"),
      getTranslations("AirportSummary"),
      getTranslations("Footer"),
    ]);
  // Content-hub link targets. Deep anchors: the "AIP" word jumps to the AIP
  // glossary term, "AIRAC" to the "AIRAC cycle" guide section (not just the page
  // top). SSR, reuses the Footer namespace labels - no new i18n string.
  const hub = await getHubLinks(locale);
  // Tag handlers for the two content-hub links inside the per-airport prose:
  // the `<glossary>AIP</glossary>` and `<guides>AIRAC</guides>` acronyms wrapped
  // in every AirportSummary locale string. Permanent underline (axe
  // link-in-text-block).
  const summaryLinks = {
    glossary: (chunks: React.ReactNode) => (
      <a
        href={hub.aipTerm}
        title={tFooter("glossary.hrefTitle")}
        className="text-drossblue underline"
      >
        {chunks}
      </a>
    ),
    guides: (chunks: React.ReactNode) => (
      <a
        href={hub.airacGuide}
        title={tFooter("guides.hrefTitle")}
        className="text-drossblue underline"
      >
        {chunks}
      </a>
    ),
  };

  // Direct chart PDF (chart-PDF plan Stage 2): prefer the crawler-captured
  // `pdf_url` where a country's crawler stores an index page as `url`; fall
  // back to `url` itself when it already points at a PDF (Stage 1 behaviour).
  const chartPdfUrl =
    airport.pdfUrl ?? (isPdfUrl(airport.url) ? airport.url : null);
  // The source's full chart list (crawler-captured JSON; [] when absent).
  const chartList = parseCharts(airport.charts);

  let lat = facts?.lat ?? null;
  let lon = facts?.lon ?? null;

  // ICAO-less fields (hospital / private helipads) have no ICAO-keyed facts
  // source, so no coordinates - which would leave the weather, nearby and
  // sun-time gadgets empty. Fall back to geocoding the field name so those
  // coordinate-driven boxes still work (approximate; fail-soft).
  if (lat == null || lon == null) {
    const geocoded = await forwardGeocode(airport.title, airport.country);
    if (geocoded) {
      lat = geocoded.lat;
      lon = geocoded.lon;
    }
  }

  // The postal address is persisted in D1 once the importer has backfilled it;
  // only geocode live (Nominatim) as a fallback for ICAOs that have none stored.
  const hasStoredAddress =
    facts?.street != null || facts?.postcode != null || facts?.phone != null;
  const geo =
    !hasStoredAddress && lat != null && lon != null
      ? await reverseGeocode(lat, lon)
      : null;
  const openingHours = facts?.openingHours ?? geo?.openingHours ?? null;
  // OpenStreetMap community hours (LOWEST precedence): only when no better
  // structured source (eaip/openaip) exists. Parsed to our UTC model (OSM times
  // are local -> converted from longitude) and used for the badge / JSON-LD this
  // request AND persisted (source "osm") so the airport-list map picks it up
  // next time. Conservative: an unparseable string yields no hours (still shows
  // the honest "no operating hours" note). Only when the field carries an ICAO.
  const osmHours =
    !facts?.hoursStructured && geo?.openingHours && lat != null && lon != null
      ? parseOsmHours(geo.openingHours, { lat, lon })
      : null;
  // `hoursStructured` here is the PARSED object (NormalizedFacts already parsed
  // the DB JSON); OSM fills it only when nothing better exists.
  const hoursStructured = facts?.hoursStructured ?? osmHours;
  const hoursSource = facts?.hoursSource ?? (osmHours ? "osm" : null);
  if (osmHours && airport.icao) {
    const icao = airport.icao;
    const json = JSON.stringify(osmHours); // DB column is JSON text
    after(() =>
      MUTATIONS.upsertAirportHours([
        { icao, hoursStructured: json, hoursSource: "osm" },
      ]).catch(() => undefined),
    );
  }
  // Facts with the effective hours merged in (OSM fallback when nothing better),
  // so the aerodrome-data badge, the JSON-LD and the map read the same value.
  const factsWithHours = facts
    ? { ...facts, hoursStructured, hoursSource }
    : facts;
  const street =
    facts?.street ??
    (geo
      ? [geo.road, geo.houseNumber].filter(Boolean).join(" ") || null
      : null);
  const postcode = facts?.postcode ?? geo?.postcode ?? null;
  const city = facts?.municipality ?? geo?.city ?? null;
  const phone = facts?.phone ?? geo?.phone ?? null;
  const website = facts?.homeLink ?? geo?.website ?? null;
  // Same Google Maps link the location box renders (coords when known, else the
  // ICAO/name) -> schema.org `hasMap`.
  const mapQuery =
    lat != null && lon != null
      ? `${lat},${lon}`
      : `${airport.icao ?? airport.title} airport`;
  const hasMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapQuery,
  )}`;

  // Every remaining item of the two boxes with no first-class schema.org field,
  // as PropertyValue entries so the Airport JSON-LD mirrors what is displayed.
  const lang = localeLangMapping[locale] ?? "en";
  // AIRAC edition date for detail pages WITHOUT a chart-PDF box (the box shows
  // its own AIRAC inline, so we never duplicate it). Prefer the field's own
  // edition-dated URL (IS/FR); fall back to the country's stamped edition
  // (crawl_meta.airac) for sources whose URLs carry no date (DE permalinks,
  // BE/FI eAIP aliases). Only query the country edition when actually needed.
  const chartUrlAiracIso = chartPdfUrl ? airacDateFromUrl(chartPdfUrl) : null;
  const boxlessUrlAiracIso = chartPdfUrl ? null : airacDateFromUrl(airport.url);
  // Query the country's stamped edition (crawl_meta.airac) only when the
  // field's own URL carries NO date - a dateless chart box (MK's `current`
  // alias) or a boxless source (DE permalinks). Every detail page must show the
  // AIRAC cycle, so the box falls back to the country edition too, not just the
  // boxless line.
  const needCountryAirac =
    (chartPdfUrl && chartUrlAiracIso === null) ||
    (!chartPdfUrl && boxlessUrlAiracIso === null);
  const countryAiracIso = needCountryAirac
    ? await QUERIES.crawlAirac(airport.country)
    : null;
  // Boxless AIRAC line: the field's URL date, else the country edition.
  const detailAiracIso = chartPdfUrl
    ? null
    : (boxlessUrlAiracIso ?? countryAiracIso);
  const detailAiracLabel = detailAiracIso
    ? new Intl.DateTimeFormat(lang, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${detailAiracIso}T00:00:00Z`))
    : null;
  const runways = facts?.runways ?? [];
  const surfaces = [...new Set(runways.map((r) => r.surface).filter(Boolean))];

  // Descriptive SSR prose (GEO/SEO): the detail pages otherwise carry only data
  // widgets. Composed purely from the field's OWN data, so it is unique per
  // aerodrome, not boilerplate. Titles are `<name> <ICAO>` by convention -
  // strip the trailing ICAO for the readable place name. The AIRAC clause reuses
  // the same edition the box / boxless line already resolved (chart URL date,
  // else the country's stamped edition). Sits inside the reserved min-h region
  // below, so it cannot shift layout.
  const summaryPlaceName =
    airport.icao && airport.title.endsWith(` ${airport.icao}`)
      ? airport.title.slice(0, -(airport.icao.length + 1))
      : airport.title;
  const summaryAiracIso = chartPdfUrl
    ? (chartUrlAiracIso ?? countryAiracIso)
    : detailAiracIso;
  const summaryAiracLabel = summaryAiracIso
    ? new Intl.DateTimeFormat(lang, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${summaryAiracIso}T00:00:00Z`))
    : null;
  const airportSummary = buildAirportSummary(
    tSummary,
    {
      name: summaryPlaceName,
      icao: airport.icao,
      type: airport.type,
      town: city,
      runwayCount: runways.length,
      hasChart: chartPdfUrl != null,
      airac: summaryAiracLabel,
    },
    summaryLinks,
  );
  // DE-only OCR'd AD-2 text, locale-appropriate (German narrative on /de,
  // English pages on /de/en), shared by the visible AirportAipText block AND
  // the Airport JSON-LD property below so the two never diverge.
  const ad2Display =
    lang === "de"
      ? (facts?.ad2TextDe ?? facts?.ad2Text)
      : (facts?.ad2Text ?? facts?.ad2TextDe);

  const props: Array<{ name: string; value: string }> = [];
  const addProp = (name: string, value: string | null | undefined) => {
    if (value) props.push({ name, value });
  };
  addProp("Aerodrome type", aerodromeTypeLabel(facts?.aerodromeType, lang));
  addProp("Runway surface", surfaces.join(", "));
  addProp("Fuel", facts?.fuel.length ? facts.fuel.join(", ") : null);
  if (facts?.ppr != null) addProp("PPR", facts.ppr ? "Yes" : "No");
  // Canonical schema.org opening hours from the structured form (grouped fixed
  // days; solar/notam/unknown days omitted). The free-text PropertyValue below
  // stays as the fallback for fields with only an unstructured hours string.
  const openingHoursSpec = toOpeningHoursSpecification(hoursStructured);
  if (openingHoursSpec.length === 0) addProp("Opening hours", openingHours);
  // Runways and frequencies as GRANULAR PropertyValue entries - one per runway,
  // one per frequency SERVICE type - instead of a single semicolon blob. More
  // precisely machine-/LLM-readable (GEO): an assistant answering "ATIS at EDDF"
  // reads {name:"ATIS", value:"118.03, 118.73"} directly. (No Google SEO effect
  // either way: Airport.additionalProperty is not used for rich results.)
  // Frequencies are grouped by service type rather than one node per frequency,
  // so a field with three TWR frequencies stays one clean "TWR" node.
  for (const r of runways) {
    addProp(
      `Runway ${r.ident}`,
      [r.lengthFt ? `${r.lengthFt} ft` : null, r.surface]
        .filter(Boolean)
        .join(", ") || null,
    );
  }
  // AD 2.13 declared distances - one granular PropertyValue per runway, so an
  // assistant answering "TORA at EHAL RWY 08" reads it directly (GEO). No free
  // dataset carries these, so the AIP is the sole source.
  for (const [desig, d] of Object.entries(facts?.declaredDistances ?? {})) {
    const parts = [
      d.tora != null ? `TORA ${d.tora} m` : null,
      d.toda != null ? `TODA ${d.toda} m` : null,
      d.asda != null ? `ASDA ${d.asda} m` : null,
      d.lda != null ? `LDA ${d.lda} m` : null,
    ].filter(Boolean);
    if (parts.length) {
      addProp(`Declared distances RWY ${desig}`, parts.join(", "));
    }
  }
  const freqByType = new Map<string, string[]>();
  for (const f of facts?.frequencies ?? []) {
    const type = f.type?.trim() || "Frequency";
    const list = freqByType.get(type) ?? [];
    list.push(String(f.mhz));
    freqByType.set(type, list);
  }
  for (const [type, list] of freqByType) {
    addProp(type, list.join(", "));
  }
  if (facts?.restaurant != null)
    addProp("Restaurant", facts.restaurant ? "Yes" : "No");
  if (facts?.customs != null) addProp("Customs", facts.customs ? "Yes" : "No");
  // DE OCR AD-2 text as a machine-readable PropertyValue (GEO/LLM signal; the
  // name flags the OCR provenance). Length-capped so the inline JSON-LD does not
  // balloon on big fields (some OCR to tens of KB); the full text stays in the
  // visible AirportAipText block. Not a Google rich-result field - GEO only.
  if (ad2Display) {
    addProp(
      "AIP aerodrome information (machine-read via OCR)",
      truncateForJsonLd(ad2Display),
    );
  }

  return (
    // min-h matches the streaming fallback (AirportGadgetsFallback): reserving a
    // consistent height for the whole gadget region keeps the footer from
    // shifting when the fallback is replaced AND when the lazy client weather box
    // later appears or collapses (both happen within the reserved height). Fields
    // taller than this (e.g. with a PDF chart) still grow past it; sparse fields
    // get a little trailing whitespace. Keep this value in sync with the fallback.
    <div className="mx-auto mt-24 min-h-[40rem] max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Enriched Airport JSON-LD - one facts fetch feeds this and the boxes. */}
      <SchemaAirport
        name={schemaName}
        icaoCode={airport.icao}
        alternateName={schemaAlternateName}
        description={schemaDescription}
        url={schemaUrl}
        latitude={lat}
        longitude={lon}
        elevationFt={facts?.elevationFt ?? null}
        street={street}
        postalCode={postcode}
        city={city}
        telephone={phone}
        sameAs={website}
        hasMap={hasMap}
        openingHoursSpecification={openingHoursSpec}
        additionalProperties={props}
      />
      {/* Records this view in the localStorage recents index (renders
          nothing; feeds the "recently viewed" list on the country page). */}
      <RecentTracker slug={airport.slug} title={airport.title} />
      <div className="flex flex-col gap-4">
        {/* Explicit "save for offline" (PWA Phase 3): pins this page (and a
            direct-PDF chart) in the never-trimmed offline caches. */}
        <SaveOfflineButton
          slug={airport.slug}
          title={airport.title}
          chartUrl={chartPdfUrl}
          saveLabel={tCommon("saveOffline")}
          savedLabel={tCommon("savedOffline")}
          installHintLabel={tCommon("installHint")}
          installHintMacLabel={tCommon("installHintMac")}
        />
        {/* Cross-type sibling pages: plain followed same-tab links (internal
            linking between the VFR/IFR/heliport variants of the same field).
            The aria-label starts with the visible text (label-in-name) and
            appends the target page's SEO title. */}
        {related.length > 0 && (
          <p className="flex flex-wrap items-center justify-center gap-x-6 text-center">
            {related.map((r) => (
              <a
                key={r.type}
                href={r.url}
                title={r.title}
                aria-label={`${tCommon("alsoAvailable")} ${r.label} - ${r.title}`}
                className="text-drossblue inline-flex min-h-10 items-center gap-x-1 hover:underline"
              >
                {tCommon("alsoAvailable")}&nbsp;<strong>{r.label}</strong>
              </a>
            ))}
          </p>
        )}
        {chartPdfUrl && (
          <>
            <AirportChart
              url={chartPdfUrl}
              charts={chartList}
              locale={locale}
              fallbackAiracIso={countryAiracIso}
              airportLabel={airport.title}
            />
            {/* Structured-data twin of the chart box: marks the PDF up as a
                DigitalDocument that is part of this airport page, dated by
                the AIRAC edition and carrying the other charts as hasPart. */}
            <SchemaDigitalDocument
              name={schemaName}
              alternateName={schemaAlternateName}
              description={schemaDescription}
              url={chartPdfUrl}
              isPartOfUrl={schemaUrl}
              datePublished={chartUrlAiracIso ?? countryAiracIso}
              charts={chartList}
              lang={lang}
            />
          </>
        )}
        {/* Per-field chart-availability note (owner directive #5b): when this
            field has no direct chart PDF, say so honestly - the AIP link opens
            the official aerodrome entry rather than a chart sheet. Suppressed
            for (a) login-gated portals (ch/mt/md - they already show the
            aipLoginHint next to the AIP button) and (b) self-service PDF
            sources (DE/DFS BasicVFR, where the pilot exports the chart PDF from
            the AIP page itself, so "no chart PDF is published" is misleading). */}
        {!chartPdfUrl &&
          !isGatedCountry(airport.country) &&
          !isSelfServicePdfCountry(airport.country) && (
            <p className="text-drossgray-dark text-center text-sm">
              {tCommon("noChartPdf")}
            </p>
          )}
        {/* AIRAC edition line for detail pages WITHOUT a chart-PDF box (DE's
            DFS BasicVFR HTML permalinks, BE/FI eAIP aliases, ...) - the box
            carries its own AIRAC inline, so this only renders when there is no
            box, surfacing the data currency there too. */}
        {detailAiracLabel && (
          <p className="text-drossgray-dark text-center text-sm">
            <a
              href={hub.airacGuide}
              title={tFooter("guides.hrefTitle")}
              className="text-drossblue underline"
            >
              AIRAC
            </a>{" "}
            {detailAiracLabel}
          </p>
        )}
        {/* Generated descriptive paragraph (GEO/SEO): a unique, human-readable
            summary built from this field's own data, so the high-volume detail
            pages carry real prose an LLM can cite - not just data widgets. Pure
            SSR text inside the reserved region, so no LCP/CLS cost. */}
        <p className="text-drossgray-dark mx-auto max-w-3xl text-center text-sm leading-relaxed">
          {airportSummary}
        </p>
        {/* DE-only raw AD-2 text (OCR'd from the DFS page image, since DFS
            serves AD-2 as a base64 PNG). DISPLAY-only under a "verify against
            the AIP" caveat - never parsed into hours / the badge / the map /
            JSON-LD (owner safety directive). Renders only when the crawler
            captured text for this field (the ~40 big Verkehrsflughaefen). */}
        {airport.country === "DE" && ad2Display && (
          <AirportAipText
            text={ad2Display}
            sourceUrl={airport.url}
            locale={locale}
          />
        )}
        {/* Location + aerodrome-data boxes side by side on >= md (each half
            width, stretched to equal height), stacking on mobile. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AirportContact
            airport={airport}
            facts={facts}
            geo={geo}
            lat={lat}
            lon={lon}
          />
          <AirportFacts
            facts={factsWithHours}
            locale={locale}
            openingHours={openingHours}
            airportLabel={airport.title}
            lat={lat}
            lon={lon}
          />
        </div>
        {/* Trade:Aero cross-sell (locale + country aware), above the weather
            box - same discreet SSR text CTA as on the country / list pages. */}
        <TradeAeroCta />
        {/* Scaled runway-layout diagram (SSR): the physical field geometry to
            RELATIVE length + surface colour. Sits next to the wind box and,
            unlike it, renders for every field with runways (no METAR needed). */}
        <AirportRunwayDiagram
          runways={facts?.runways ?? []}
          airportLabel={airport.title}
        />
        {/* Ephemeral weather + wind: lazy-loaded client-side. The Weather i18n
            namespace is scoped to this client subtree. */}
        <NextIntlClientProvider messages={pick(messages, "Weather")}>
          <AirportWeatherWindLazy
            icao={airport.icao}
            lat={lat}
            lon={lon}
            runways={facts?.runways ?? []}
            locale={locale}
          />
        </NextIntlClientProvider>
        <AirportNearby
          slug={airport.slug}
          lat={lat}
          lon={lon}
          country={airport.country}
          locale={locale}
          airportLabel={airport.title}
        />
        {/* Feedback / "report a problem" link: routes to the contact form
            (German-native locales -> /de/kontakt/, else /contact/) carrying the
            aerodrome reference (?icao= or, for ICAO-less fields, ?ref=<slug>) so
            the form pre-fills it. Plain SSR anchor, no client JS, no CLS (inside
            the reserved min-h region). rel="nofollow" keeps crawlers off the
            many ?icao= variants (the contact page canonicalises to the bare
            URL). Carries a localized SEO title per the every-link-needs-a-title
            rule. */}
        <p className="text-drossgray-dark mt-2 text-center text-sm">
          <a
            href={contactUrlFor(locale, {
              icao: airport.icao,
              slug: airport.slug,
            })}
            rel="nofollow"
            title={tCommon("reportProblemTitle")}
            className="text-drossblue inline-flex min-h-10 items-center gap-x-1.5 hover:underline"
          >
            <FlagIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{tCommon("reportProblem")}</span>
          </a>
        </p>
      </div>
    </div>
  );
}

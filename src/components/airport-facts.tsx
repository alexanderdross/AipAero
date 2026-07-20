import { getTranslations } from "next-intl/server";
import { SectionHeading } from "~/components/section-heading";
import { localeLangMapping } from "~/i18n/routing";
import { aerodromeTypeLabel } from "~/lib/aerodrome-type";
import type { NormalizedFacts } from "~/lib/airport-facts";
import type { Boundary, DayHours } from "~/lib/opening-hours";
import { minutesToHhmm, openStatus } from "~/lib/opening-hours";
import { runwayLengthLabel } from "~/lib/runway-diagram";
import { getSunTimes } from "~/lib/sun-times";

// Monday in UTC (2024-01-01 is a Monday) - base for localized weekday names in
// the opening-hours table (day index 0 = Mon .. 6 = Sun).
const WEEK_BASE_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

const FT_PER_M = 0.3048;

/**
 * Server-rendered aerodrome-data box: elevation, runways (orientation / length /
 * surface), frequencies, opening hours and today's sunrise / sunset / civil
 * twilight (VFR night). Data is merged from OpenAIP / OurAirports / AWC (see
 * `~/lib/airport-facts`); coordinates + elevation come from those (AWC is the
 * always-on fallback), and `openingHours` is resolved by the wrapper (OpenAIP
 * else OSM). Sun times are computed locally (no API). The fields are laid out as
 * a two-column table on >= sm. Renders nothing when there is nothing to show.
 */
export async function AirportFacts({
  facts,
  locale,
  openingHours,
  airportLabel = null,
  lat: latFallback = null,
  lon: lonFallback = null,
}: {
  facts: NormalizedFacts | null;
  locale: string;
  openingHours: string | null;
  /** Aerodrome "<name> <ICAO>" for the section-anchor SEO title. */
  airportLabel?: string | null;
  // Coordinate fallback (e.g. geocoded from the name for ICAO-less fields) so
  // the sun-time rows can render even without a facts row.
  lat?: number | null;
  lon?: number | null;
}) {
  const t = await getTranslations("Weather");
  const lang = localeLangMapping[locale] ?? "en";

  const elevFt = facts?.elevationFt ?? null;
  const lat = facts?.lat ?? latFallback;
  const lon = facts?.lon ?? lonFallback;

  const timeFmt = new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
  });
  const hm = (d: Date | null) => (d ? `${timeFmt.format(d)} UTC` : null);

  const runways = facts?.runways ?? [];
  const frequencies = facts?.frequencies ?? [];

  // Distinct runway surfaces, for a quick-glance "surface" row (the per-runway
  // detail still shows in the runways line below).
  const surfaces = [...new Set(runways.map((r) => r.surface).filter(Boolean))];
  const aType = aerodromeTypeLabel(facts?.aerodromeType, lang);

  // Advisory open/closed status from the structured hours (opening-hours.ts),
  // computed for the field's "now" in UTC. `unknown`/`notam` days yield no badge
  // (we never assert an open/closed we cannot back up).
  const status =
    facts?.hoursStructured && lat != null && lon != null
      ? openStatus(facts.hoursStructured, { lat, lon })
      : null;
  const statusBadge =
    status && status.state !== "unknown"
      ? (() => {
          // AIP AD 2.3 hours are UTC; the "Z" suffix (aviation "Zulu") marks it
          // without a per-locale string. `openStatus` computes in UTC too.
          if (status.state === "open") {
            const closes =
              status.closesAt != null
                ? ` - ${t("closesAt", { time: `${minutesToHhmm(status.closesAt)}Z` })}`
                : "";
            return `${t("statusOpen")}${closes}`;
          }
          const opens =
            status.opensAt != null
              ? ` - ${t("opensAt", { time: `${minutesToHhmm(status.opensAt)}Z` })}`
              : "";
          return `${t("statusClosed")}${opens}`;
        })()
      : null;
  const isOcrHours = facts?.hoursSource === "dfs-ocr-hours";
  // OCR-sourced hours carry no inline source label - the always-visible
  // hoursOcrDisclaimer below already states the OCR provenance (no duplication).
  const hoursSourceLabel =
    facts?.hoursSource === "eaip"
      ? t("hoursOfficial")
      : facts?.hoursSource === "openaip" || facts?.hoursSource === "osm"
        ? t("hoursCommunity")
        : null;
  // No actionable hours: no open/closed badge AND no clock-time schedule text
  // (hours are absent, or given only as O/R / HO / by NOTAM). Show an honest
  // note instead of a blank - many small VFR fields / heliports publish none.
  // A field with a definite badge or a real schedule string does not get it.
  // Per-weekday opening-hours table (Mon..Sun) from the structured hours - one
  // row per day, so a pilot sees every day explicitly rather than a grouped
  // summary. Rendered only when at least one day is concrete (a window / H24 /
  // NOTAM); an all-unknown week falls back to the free-text line or the note.
  const boundaryText = (x: Boundary) =>
    x.t === "sr" ? "SR" : x.t === "ss" ? "SS" : minutesToHhmm(x.m);
  const dayHoursText = (dh: DayHours): string => {
    switch (dh.kind) {
      case "h24":
        return "H24";
      case "notam":
        return "NOTAM";
      case "closed":
        return t("statusClosed");
      case "window":
        return `${boundaryText(dh.open)}-${boundaryText(dh.close)}`;
      default:
        return "-"; // unknown - never asserted
    }
  };
  const structured = facts?.hoursStructured ?? null;
  const hasConcreteDay =
    structured != null && structured.some((d) => d.kind !== "unknown");
  const weekdayFmt = new Intl.DateTimeFormat(lang, {
    weekday: "short",
    timeZone: "UTC",
  });
  const weekdayRows: Array<[string, string]> = hasConcreteDay
    ? structured!.map((dh, d) => [
        weekdayFmt.format(new Date(WEEK_BASE_MS + d * DAY_MS)),
        dayHoursText(dh),
      ])
    : [];

  // Compact free-text hours line only when there is no per-weekday table (a
  // field with a remarks string but no structured hours).
  const compactHours = hasConcreteDay ? null : openingHours;
  const hasScheduleText =
    hasConcreteDay ||
    (compactHours != null &&
      /\d{3,4}|\d{1,2}[:h.]\d{2}|\bsr\b|\bss\b|sun(rise|set)/i.test(
        compactHours,
      ));
  const showHoursNote = !statusBadge && !hasScheduleText;

  const rows: Array<[string, string]> = [];
  if (aType) rows.push([t("aerodromeType"), aType]);
  if (elevFt != null)
    rows.push([
      t("elevation"),
      `${elevFt} ft (${Math.round(elevFt * FT_PER_M)} m)`,
    ]);
  if (surfaces.length) rows.push([t("surface"), surfaces.join(", ")]);
  if (facts?.fuel.length) rows.push([t("fuel"), facts.fuel.join(", ")]);
  if (facts?.ppr === true) rows.push([t("ppr"), t("pprRequired")]);
  if (compactHours) rows.push([t("openingHours"), compactHours]);
  if (lat != null && lon != null) {
    const sun = getSunTimes(new Date(), lat, lon);
    if (sun.sunrise) rows.push([t("sunrise"), hm(sun.sunrise)!]);
    if (sun.sunset) rows.push([t("sunset"), hm(sun.sunset)!]);
    if (sun.civilDawn && sun.civilDusk)
      rows.push([
        t("civilTwilight"),
        `${timeFmt.format(sun.civilDawn)} - ${hm(sun.civilDusk)}`,
      ]);
  }

  // Circuit (traffic-pattern) direction per runway, when OpenAIP provided an
  // unambiguous value (see `~/lib/openaip`); rendered as "(Platzrunde links)".
  const circuit = (r: (typeof runways)[number]): string | null => {
    if (r.trafficPattern === "left")
      return `(${t("circuit")} ${t("circuitLeft")})`;
    if (r.trafficPattern === "right")
      return `(${t("circuit")} ${t("circuitRight")})`;
    return null;
  };
  const runwaysText = runways
    .map((r) =>
      [r.ident, runwayLengthLabel(r.lengthFt), r.surface, circuit(r)]
        .filter(Boolean)
        .join(" "),
    )
    .join(" · ");
  const frequenciesText = frequencies
    .map((f) => `${f.type} ${f.mhz}`.trim())
    .join(" · ");

  // AD 2.13 declared distances (authoritative eAIP): one compact line per
  // runway grouped with the runway data - "08: TORA 860 · TODA 860 · ...".
  // TORA/TODA/ASDA/LDA are universal ICAO abbreviations (no translation).
  const declaredRows: Array<[string, string]> = Object.entries(
    facts?.declaredDistances ?? {},
  )
    .map(([desig, d]): [string, string] => {
      const parts = [
        d.tora != null ? `TORA ${d.tora}` : null,
        d.toda != null ? `TODA ${d.toda}` : null,
        d.asda != null ? `ASDA ${d.asda}` : null,
        d.lda != null ? `LDA ${d.lda}` : null,
      ].filter(Boolean);
      return [desig, parts.join(" · ")];
    })
    .filter(([, v]) => v.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (
    rows.length === 0 &&
    weekdayRows.length === 0 &&
    !runwaysText &&
    !frequenciesText &&
    declaredRows.length === 0
  )
    return null;

  const cell = "border-drossgray flex justify-between gap-x-3 border-b py-1";

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading
        className="text-center text-xl font-normal"
        linkTitle={
          airportLabel ? `${t("facts")} - ${airportLabel}` : t("facts")
        }
      >
        {t("facts")}
      </SectionHeading>

      {/* Two-column table on >= sm; runways/frequencies span both columns. */}
      <dl className="mt-3 grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className={cell}>
            <dt className="text-drossgray-dark">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
        {weekdayRows.length > 0 && (
          <div
            className={`${cell} flex-col items-stretch gap-0.5 sm:col-span-2`}
          >
            <dt className="text-drossgray-dark">
              {t("openingHours")} <span className="font-normal">(UTC)</span>
            </dt>
            {/* Compact two-column weekday grid on >= sm (7 days in 4 rows); one
                column on mobile. Smaller text keeps the block low-profile. */}
            <dd className="mt-0.5 grid grid-cols-1 gap-x-8 text-xs font-medium sm:grid-cols-2">
              {weekdayRows.map(([day, value], i) => (
                <div key={i} className="flex items-baseline justify-between">
                  <span className="text-drossgray-dark font-normal">{day}</span>
                  <span>{value}</span>
                </div>
              ))}
            </dd>
          </div>
        )}
        {runwaysText && (
          <div className={`${cell} sm:col-span-2`}>
            <dt className="text-drossgray-dark">{t("runways")}</dt>
            <dd className="text-right font-medium">{runwaysText}</dd>
          </div>
        )}
        {frequenciesText && (
          <div className={`${cell} sm:col-span-2`}>
            <dt className="text-drossgray-dark">{t("frequencies")}</dt>
            <dd className="text-right font-medium">{frequenciesText}</dd>
          </div>
        )}
        {declaredRows.length > 0 && (
          <div className={`${cell} flex-col items-stretch gap-1 sm:col-span-2`}>
            <dt className="text-drossgray-dark">
              {t("declaredDistances")} <span className="font-normal">(m)</span>
            </dt>
            <dd className="space-y-0.5 text-right font-medium">
              {declaredRows.map(([desig, v]) => (
                <div key={desig}>
                  <span className="text-drossgray-dark font-normal">
                    {desig}:
                  </span>{" "}
                  {v}
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* Advisory open/closed status computed from the structured hours (open
          now / closes HH:MM). The coloured pill is a quick-glance signal; the
          source label + advisory note keep it honest (times are advisory + a
          local-time approximation). Renders nothing when the status is unknown
          or the field has no structured hours. */}
      {statusBadge && (
        <div className="mt-3 flex flex-col items-center gap-1 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-2">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                status?.state === "open"
                  ? "bg-green-100 text-green-800"
                  : "bg-drossgray text-drossgray-dark"
              }`}
            >
              {statusBadge}
            </span>
            {hoursSourceLabel && (
              <span className="text-drossgray-dark text-xs">
                {hoursSourceLabel}
              </span>
            )}
          </p>
          <p className="text-drossgray-dark text-xs">{t("hoursAdvisory")}</p>
        </div>
      )}

      {/* No actionable hours: honest note rather than a blank (many small VFR
          fields / heliports publish none, or only O/R / HO / by NOTAM). */}
      {showHoursNote && (
        <p className="text-drossgray-dark mt-3 text-center text-xs">
          {t("hoursNone")}
        </p>
      )}

      {/* DE OCR-derived hours: an always-visible disclaimer that the schedule
          was machine-read from the DFS AIP page image and may contain read
          errors - the honesty backstop for driving the badge/map/JSON-LD from
          OCR (owner directive 20.07.2026). Renders whenever the field's hours
          came from the OCR pipeline. */}
      {isOcrHours && (
        <p role="note" className="mt-3 text-center text-xs text-amber-800">
          {t("hoursOcrDisclaimer")}
        </p>
      )}
    </section>
  );
}

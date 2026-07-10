import { getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import { aerodromeTypeLabel } from "~/lib/aerodrome-type";
import type { NormalizedFacts } from "~/lib/airport-facts";
import { getSunTimes } from "~/lib/sun-times";

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
  lat: latFallback = null,
  lon: lonFallback = null,
}: {
  facts: NormalizedFacts | null;
  locale: string;
  openingHours: string | null;
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
  if (openingHours) rows.push([t("openingHours"), openingHours]);
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
      [r.ident, r.lengthFt ? `${r.lengthFt} ft` : null, r.surface, circuit(r)]
        .filter(Boolean)
        .join(" "),
    )
    .join(" · ");
  const frequenciesText = frequencies
    .map((f) => `${f.type} ${f.mhz}`.trim())
    .join(" · ");

  if (rows.length === 0 && !runwaysText && !frequenciesText) return null;

  const cell = "border-drossgray flex justify-between gap-x-3 border-b py-1";

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-center text-xl font-normal">{t("facts")}</h2>

      {/* Two-column table on >= sm; runways/frequencies span both columns. */}
      <dl className="mt-3 grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className={cell}>
            <dt className="text-drossgray-dark">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
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
      </dl>
    </section>
  );
}

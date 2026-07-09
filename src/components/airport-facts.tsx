import { getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import type { NormalizedFacts } from "~/lib/airport-facts";
import { getSunTimes } from "~/lib/sun-times";
import type { Metar } from "~/lib/weather";

const FT_PER_M = 0.3048;

/**
 * Server-rendered aerodrome-data box: elevation, runways (orientation / length /
 * surface), frequencies, opening hours and today's sunrise / sunset / civil
 * twilight (VFR night). Data is merged from OurAirports (D1) and OpenAIP (when a
 * key is set) - see `~/lib/airport-facts`; the METAR is a fallback source for
 * elevation and coordinates when the facts row is missing, and `openingHours` is
 * resolved by the wrapper (OpenAIP else OSM). Sun times are computed locally (no
 * API). The fields are laid out as a two-column table on >= sm. Renders nothing
 * when there is nothing to show.
 */
export async function AirportFacts({
  facts,
  metar,
  locale,
  openingHours,
}: {
  facts: NormalizedFacts | null;
  metar: Metar | null;
  locale: string;
  openingHours: string | null;
}) {
  const t = await getTranslations("Weather");
  const lang = localeLangMapping[locale] ?? "en";

  // Elevation: prefer the facts row (ft), fall back to the METAR station (metres).
  const elevFt =
    facts?.elevationFt ??
    (metar?.elev != null ? Math.round(metar.elev / FT_PER_M) : null);

  // Coordinates for the sunrise/sunset calc: facts row first, then the METAR.
  const lat = facts?.lat ?? metar?.lat ?? null;
  const lon = facts?.lon ?? metar?.lon ?? null;

  const timeFmt = new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
  });
  const hm = (d: Date | null) => (d ? `${timeFmt.format(d)} UTC` : null);

  const rows: Array<[string, string]> = [];
  if (elevFt != null)
    rows.push([
      t("elevation"),
      `${elevFt} ft (${Math.round(elevFt * FT_PER_M)} m)`,
    ]);
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

  const runways = facts?.runways ?? [];
  const frequencies = facts?.frequencies ?? [];
  const runwaysText = runways
    .map((r) =>
      [r.ident, r.lengthFt ? `${r.lengthFt} ft` : null, r.surface]
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
    <section className="border border-[#ccc] bg-white p-4">
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

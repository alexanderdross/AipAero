import { getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import { getAirportWeather, type CloudLayer } from "~/lib/weather";

// Flight-category badge colour (VFR/MVFR/IFR/LIFR is the standard NOAA scheme).
const FLT_CAT_COLOR: Record<string, string> = {
  VFR: "bg-green-600",
  MVFR: "bg-blue-600",
  IFR: "bg-red-600",
  LIFR: "bg-fuchsia-700",
};

function formatClouds(clouds: CloudLayer[]): string | null {
  if (!clouds.length) return null;
  const parts = clouds
    .filter((c) => c.cover && c.cover !== "CLR" && c.cover !== "SKC")
    .map((c) => (c.base != null ? `${c.cover} ${c.base} ft` : c.cover));
  return parts.length ? parts.join(", ") : null;
}

/**
 * Server-rendered METAR/TAF gadget for an airport detail page. Renders nothing
 * when the field has no reporting station (the common case for small VFR
 * fields), so it never clutters the page. All data is fetched + cached on the
 * server (see `~/lib/weather`); the raw METAR/TAF are shown verbatim (pilots
 * read them directly) alongside a decoded summary and the flight-category badge.
 */
export async function AirportWeather({
  icao,
  locale,
}: {
  icao: string | null;
  locale: string;
}) {
  const { metar, taf } = await getAirportWeather(icao);
  if (!metar && !taf) return null;

  const t = await getTranslations("Weather");
  const lang = localeLangMapping[locale] ?? "en";

  const observed =
    metar?.obsTime != null
      ? new Intl.DateTimeFormat(lang, {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          hourCycle: "h23",
        }).format(new Date(metar.obsTime)) + " UTC"
      : null;

  const wind =
    metar?.wspd != null
      ? `${metar.wdir ?? "---"}° ${metar.wspd} kt${metar.wgst ? ` (G ${metar.wgst})` : ""}`
      : null;
  const clouds = metar ? formatClouds(metar.clouds) : null;
  const temp =
    metar?.temp != null
      ? `${metar.temp}${metar.dewp != null ? ` / ${metar.dewp}` : ""} °C`
      : null;

  const rows: Array<[string, string]> = [];
  if (wind) rows.push([t("wind"), wind]);
  if (metar?.visib != null) rows.push([t("visibility"), String(metar.visib)]);
  if (clouds) rows.push([t("clouds"), clouds]);
  if (temp) rows.push([t("temperature"), temp]);
  if (metar?.altim != null) rows.push([t("qnh"), `${metar.altim} hPa`]);

  return (
    <section className="border border-[#ccc] bg-white p-4">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-normal">{t("title")}</h2>
        {metar?.fltCat && (
          <span
            className={`${FLT_CAT_COLOR[metar.fltCat] ?? "bg-drossgray-dark"} rounded px-2 py-0.5 text-sm font-medium text-white`}
          >
            {metar.fltCat}
          </span>
        )}
        {observed && (
          <span className="text-drossgray-dark text-sm">
            {t("observed")}: {observed}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-x-1">
              <dt className="text-drossgray-dark">{label}:</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {metar && (
        <pre className="bg-drossgray mt-3 overflow-x-auto rounded p-2 text-center text-sm break-words whitespace-pre-wrap">
          {metar.raw}
        </pre>
      )}
      {taf && (
        <>
          <p className="text-drossgray-dark mt-2 text-center text-sm">
            {t("forecast")}
          </p>
          <pre className="bg-drossgray mt-1 overflow-x-auto rounded p-2 text-center text-sm break-words whitespace-pre-wrap">
            {taf.raw}
          </pre>
        </>
      )}

      <p className="text-drossgray-dark mt-2 text-center text-xs">
        {t("source")}: aviationweather.gov (NOAA)
      </p>
    </section>
  );
}

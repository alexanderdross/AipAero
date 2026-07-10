"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { SectionHeading } from "~/components/section-heading";
import { localeLangMapping } from "~/i18n/routing";
import { decodeReport } from "~/lib/metar-decode";
import { type CloudLayer, type Metar, type Taf } from "~/lib/weather";

// Flight-category badge colour (VFR/MVFR/IFR/LIFR is the standard NOAA scheme).
// Shades are chosen dark enough that white text clears WCAG AA contrast (>= 4.5:1)
// - the 600-weight greens/blues/reds do not, and Lighthouse flags them.
const FLT_CAT_COLOR: Record<string, string> = {
  VFR: "bg-green-800",
  MVFR: "bg-blue-700",
  IFR: "bg-red-700",
  LIFR: "bg-fuchsia-800",
};

function formatClouds(clouds: CloudLayer[]): string | null {
  if (!clouds.length) return null;
  const parts = clouds
    .filter((c) => c.cover && c.cover !== "CLR" && c.cover !== "SKC")
    .map((c) => (c.base != null ? `${c.cover} ${c.base} ft` : c.cover));
  return parts.length ? parts.join(", ") : null;
}

/**
 * Weather box: raw METAR/TAF plus a decoded quick-glance summary, the flight-
 * category badge and the observation time. Client component - the ephemeral
 * weather is lazy-loaded after the document streams (see `AirportWeatherWind`),
 * so it never holds the airport-detail document open (Lighthouse TTFB). Renders
 * nothing when the field has no reporting station. Field data (elevation,
 * sunrise/sunset) lives in the separate, still server-rendered aerodrome-data box.
 *
 * Because the raw METAR/TAF are coded, each carries a collapsible "decode" tab
 * (`<details>`) expanding the report into plain-language lines via the pure,
 * dependency-free `decodeReport` (runs client-side here).
 */
export function AirportWeather({
  metar,
  taf,
  locale,
  nearest,
}: {
  metar: Metar | null;
  taf: Taf | null;
  locale: string;
  // Set when the weather comes from the nearest reporting station (the field
  // has no METAR of its own) - shown as a clear note.
  nearest?: { station: string; distanceKm: number } | null;
}) {
  const t = useTranslations("Weather");
  if (!metar && !taf) return null;
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

  const decodedMetar = decodeReport(metar?.raw, lang);
  const decodedTaf = decodeReport(taf?.raw, lang);

  const decodeTab = (lines: ReturnType<typeof decodeReport>) =>
    lines.length > 0 ? (
      <details className="mt-1 text-sm">
        <summary className="text-drossblue cursor-pointer text-center hover:underline">
          {t("decode")}
        </summary>
        {/* Centered block with left-aligned content: a two-column grid sized to
            its content (w-fit) and centered (mx-auto). The token column is
            aligned so every decoded description starts at the same x. */}
        <dl className="mx-auto mt-2 grid w-fit grid-cols-[auto_auto] gap-x-3 gap-y-1 text-left">
          {lines.map((line, i) => (
            <Fragment key={i}>
              <dt className="text-drossgray-dark font-mono">{line.token}</dt>
              <dd>{line.text}</dd>
            </Fragment>
          ))}
        </dl>
      </details>
    ) : null;

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <SectionHeading className="text-xl font-normal">
          {t("title")}
        </SectionHeading>
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

      {nearest && (
        <p className="text-drossgray-dark mt-1 text-center text-sm italic">
          {t("nearest", {
            station: nearest.station,
            km: nearest.distanceKm,
          })}
        </p>
      )}

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
        <>
          <pre className="bg-drossgray mt-3 overflow-x-auto rounded p-2 text-center text-sm break-words whitespace-pre-wrap">
            {metar.raw}
          </pre>
          {decodeTab(decodedMetar)}
        </>
      )}
      {taf && (
        <>
          <p className="text-drossgray-dark mt-2 text-center text-sm">
            {t("forecast")}
          </p>
          <pre className="bg-drossgray mt-1 overflow-x-auto rounded p-2 text-center text-sm break-words whitespace-pre-wrap">
            {taf.raw}
          </pre>
          {decodeTab(decodedTaf)}
        </>
      )}

      <p className="text-drossgray-dark mt-2 text-center text-xs">
        {t("source")}: aviationweather.gov (NOAA)
      </p>
    </section>
  );
}

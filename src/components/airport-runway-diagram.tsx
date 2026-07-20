import { getTranslations } from "next-intl/server";
import { SectionHeading } from "~/components/section-heading";
import { compassPoint } from "~/lib/crosswind";
import { buildRunwayStrips, runwayLengthLabel } from "~/lib/runway-diagram";
import type { RunwayFact } from "~/server/db/schema";

const C = 120; // centre
const MAX_HALF = 92; // px, half-length of the longest runway

/**
 * Scaled top-down runway-layout diagram (server-rendered). Draws each runway to
 * RELATIVE length at its true bearing, coloured by surface, with the designator
 * at each physical threshold (ICAO Annex 14 - "06" is painted at the SW end you
 * land toward). Complements the wind box (which normalises runways onto one
 * compass radius for the crosswind read); this one shows the actual field
 * geometry and renders for EVERY field with runway data, including the many small
 * fields that have no weather station. Pure SSR (no client JS, no fetch) inside
 * the reserved gadget region - no LCP/CLS cost.
 */
export async function AirportRunwayDiagram({
  runways,
  airportLabel = null,
}: {
  runways: RunwayFact[];
  /** Aerodrome "<name> <ICAO>" for the section-anchor SEO title. */
  airportLabel?: string | null;
}) {
  const t = await getTranslations("Weather");
  const strips = buildRunwayStrips(runways);
  if (strips.length === 0) return null;

  // Circuit (traffic-pattern) direction, when OpenAIP gave an unambiguous value
  // - "(Platzrunde links)". Same keys as the Aerodrome-facts runways line.
  const circuit = (p: "left" | "right" | null | undefined): string | null => {
    if (p === "left") return `${t("circuit")} ${t("circuitLeft")}`;
    if (p === "right") return `${t("circuit")} ${t("circuitRight")}`;
    return null;
  };

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading
        className="text-center text-xl font-normal"
        linkTitle={
          airportLabel ? `${t("runways")} - ${airportLabel}` : t("runways")
        }
      >
        {t("runways")}
      </SectionHeading>

      <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
        <svg
          viewBox="0 0 240 240"
          className="h-52 w-52 flex-shrink-0"
          role="img"
          aria-label={`${t("runways")}: ${strips.map((s) => s.ident).join(", ")}`}
        >
          {/* North marker */}
          <text
            x={C}
            y={16}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight={600}
            fill="#374151"
          >
            N
          </text>

          {strips.map((s) => {
            const half = s.scale * MAX_HALF;
            const [x1, y1] = compassPoint(C, C, half, s.bearing);
            const [x2, y2] = compassPoint(C, C, half, (s.bearing + 180) % 360);
            return (
              <line
                key={s.ident}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={s.color}
                strokeWidth="11"
                strokeLinecap="round"
              />
            );
          })}

          {/* Designators at their physical threshold (reciprocal end). */}
          {strips.flatMap((s) => {
            const half = s.scale * MAX_HALF;
            return s.ends.map((e) => {
              const [x, y] = compassPoint(
                C,
                C,
                half + 13,
                (e.heading + 180) % 360,
              );
              return (
                <text
                  key={`${s.ident}-${e.label}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight={600}
                  fill="#4b5563"
                >
                  {e.label}
                </text>
              );
            });
          })}
        </svg>

        {/* Legend: one row per runway, tying the colour to the surface + length. */}
        <ul className="w-full max-w-xs space-y-1.5 text-sm">
          {strips.map((s) => (
            <li key={s.ident} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-mono">{s.ident}</span>
              <span className="text-drossgray-dark">
                {[
                  runwayLengthLabel(s.lengthFt),
                  s.surface,
                  circuit(s.trafficPattern),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { SectionHeading } from "~/components/section-heading";
import { compassPoint, recommendedLanding, runwayWinds } from "~/lib/crosswind";
import type { Metar } from "~/lib/weather";
import type { RunwayFact } from "~/server/db/schema";

const C = 120; // centre
const R = 94; // compass radius

interface RunwayEnd {
  label: string;
  heading: number;
}

// Distinct runway ends (deduped by bearing) parsed from the runway designators.
function runwayEnds(runways: RunwayFact[]): RunwayEnd[] {
  const seen = new Set<number>();
  const ends: RunwayEnd[] = [];
  for (const r of runways) {
    for (const raw of r.ident.split("/")) {
      const e = raw.trim();
      const m = /^(\d{1,2})/.exec(e);
      if (!m) continue;
      const n = parseInt(m[1]!, 10);
      if (n < 1 || n > 36 || seen.has(n * 10)) continue;
      seen.add(n * 10);
      ends.push({ label: e, heading: n * 10 });
    }
  }
  return ends;
}

// Distinct physical runway centre-lines (reciprocals folded onto one line).
function runwayLines(ends: RunwayEnd[]): [number, number, number, number][] {
  const seen = new Set<number>();
  const lines: [number, number, number, number][] = [];
  for (const e of ends) {
    const k = e.heading % 180;
    if (seen.has(k)) continue;
    seen.add(k);
    const [x1, y1] = compassPoint(C, C, R - 20, e.heading);
    const [x2, y2] = compassPoint(C, C, R - 20, (e.heading + 180) % 360);
    lines.push([x1, y1, x2, y2]);
  }
  return lines;
}

/**
 * Wind-components box: head/tail- and cross-wind per runway end, computed from
 * the field's own reported wind and the runway bearings (`~/lib/crosswind`), plus
 * the likely landing direction (the end most into wind). Client component,
 * lazy-loaded with the weather (see `AirportWeatherWind`); the compass (cardinals,
 * runways with end designators, the wind arrow and the highlighted recommended
 * landing end) is a pure-math SVG. Renders nothing without a numeric wind
 * direction (VRB is skipped) or runways.
 */
export function AirportWind({
  metar,
  runways,
}: {
  metar: Metar | null;
  runways: RunwayFact[];
}) {
  const t = useTranslations("Weather");
  const wdir = typeof metar?.wdir === "number" ? metar.wdir : null;
  const wspd = metar?.wspd ?? null;
  if (wdir == null || wspd == null || wspd <= 0 || runways.length === 0)
    return null;

  const winds = runwayWinds(runways, wdir, wspd);
  if (winds.length === 0) return null;

  const rec = recommendedLanding(winds);

  const ends = runwayEnds(runways);
  const lines = runwayLines(ends);
  const [ax, ay] = compassPoint(C, C, R - 1, wdir); // arrow tail (wind source)
  const [hx, hy] = compassPoint(C, C, 34, wdir); // arrow head (toward centre)
  const [lx, ly] = compassPoint(C, C, R - 1, wdir); // wind label anchor

  // International aviation convention: cardinals stay N/E/S/W in every locale
  // (localized letters would mislead - e.g. Czech "S" is North).
  const CARDINALS: Array<[string, number]> = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
  ];

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading className="text-center text-xl font-normal">
        {t("windComponents")}
      </SectionHeading>

      <div className="mt-3 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <svg
          viewBox="0 0 240 240"
          className="h-52 w-52 flex-shrink-0"
          role="img"
          aria-label={`${t("windComponents")} - ${t("wind")} ${wdir}° ${wspd} kt`}
        >
          <defs>
            <marker
              id="wind-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="4.5"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#2d6a9a" />
            </marker>
          </defs>

          {/* compass ring + degree ticks (every 30°, longer at the cardinals) */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="#d4d4d4" />
          {Array.from({ length: 12 }).map((_, i) => {
            const b = i * 30;
            const [x1, y1] = compassPoint(C, C, R, b);
            const [x2, y2] = compassPoint(C, C, R - (i % 3 === 0 ? 10 : 6), b);
            return (
              <line
                key={b}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#9ca3af"
                strokeWidth={i % 3 === 0 ? 1.5 : 1}
              />
            );
          })}
          {CARDINALS.map(([label, b]) => {
            const [x, y] = compassPoint(C, C, R + 12, b);
            return (
              <text
                key={b}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fill={b === 0 ? "#374151" : "#9ca3af"}
                fontWeight={b === 0 ? 600 : 400}
              >
                {label}
              </text>
            );
          })}

          {/* physical runways */}
          {lines.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#1f2937"
              strokeWidth="9"
              strokeLinecap="round"
            />
          ))}

          {/* runway end designators; the recommended landing end is highlighted */}
          {ends.map((e) => {
            const [x, y] = compassPoint(C, C, R - 34, e.heading);
            const isRec = rec?.heading === e.heading;
            return (
              <g key={e.heading}>
                {isRec && <circle cx={x} cy={y} r="12" fill="#16a34a" />}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight={600}
                  fill={isRec ? "#ffffff" : "#4b5563"}
                >
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* wind arrow (from the wind source toward the centre) + label */}
          <line
            x1={ax}
            y1={ay}
            x2={hx}
            y2={hy}
            stroke="#2d6a9a"
            strokeWidth="4"
            markerEnd="url(#wind-arrow)"
          />
          <text
            x={lx}
            y={ly < C ? ly - 8 : ly + 12}
            textAnchor="middle"
            fontSize="12"
            fontWeight={600}
            fill="#2d6a9a"
          >
            {wdir}° {wspd} kt
          </text>
        </svg>

        <div className="w-full max-w-xs">
          {rec && (
            <p className="mb-2 text-sm">
              <span className="text-drossgray-dark">
                {t("landingDirection")}:{" "}
              </span>
              <span className="font-semibold text-green-700">{rec.ident}</span>
            </p>
          )}
          <table className="w-full text-sm">
            <tbody>
              {winds.map((w) => {
                const isRec = rec?.heading === w.heading;
                return (
                  <tr
                    key={w.ident}
                    className={isRec ? "font-semibold" : undefined}
                  >
                    <td className="py-1 pr-3 font-mono">{w.ident}</td>
                    <td className="py-1 pr-3">
                      <span
                        className={
                          w.headwind >= 0 ? "text-green-700" : "text-red-600"
                        }
                      >
                        {w.headwind >= 0
                          ? `${t("headwind")} ${w.headwind}`
                          : `${t("tailwind")} ${Math.abs(w.headwind)}`}{" "}
                        kt
                      </span>
                    </td>
                    <td className="py-1 text-amber-700">
                      {w.crosswind > 0 ? (
                        <>
                          {t("crosswind")} {w.crosswind} kt{" "}
                          {t(
                            w.crosswindSide === "left"
                              ? "fromLeft"
                              : "fromRight",
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

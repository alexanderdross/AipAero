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
 * landing end) is a pure-math SVG. Shown for EVERY field that has a weather
 * station (a METAR) and runways: a fixed numeric wind gets the full per-runway
 * computation, a VRB/variable wind shows the compass + a "crosswind up to the
 * wind speed" note, calm shows the compass + "calm". Renders nothing only when
 * there is no METAR or no runways.
 */
export function AirportWind({
  metar,
  runways,
  icao = null,
}: {
  metar: Metar | null;
  runways: RunwayFact[];
  /** This field's ICAO, for the section-anchor SEO title. */
  icao?: string | null;
}) {
  const t = useTranslations("Weather");
  // Owner directive: EVERY field with a weather station (a METAR) shows this
  // box. A fixed numeric wind gets the full per-runway crosswind computation;
  // VRB (variable) and calm winds have no defined vector, so the box still
  // renders (compass + runways + wind state) but without per-runway numbers -
  // for a variable wind the crosswind can reach the full wind speed on any
  // runway, which is exactly what the note conveys.
  if (metar == null || runways.length === 0) return null;

  const wdir = typeof metar.wdir === "number" ? metar.wdir : null;
  const wspd = typeof metar.wspd === "number" ? metar.wspd : 0;
  const isCalm = wspd <= 0;
  const hasVector = wdir != null && wspd > 0; // fixed direction + speed
  // else (!hasVector && !isCalm) = VRB / variable: moving air, no fixed vector.

  const winds = hasVector ? runwayWinds(runways, wdir, wspd) : [];
  const rec = hasVector && winds.length > 0 ? recommendedLanding(winds) : null;

  const ends = runwayEnds(runways);
  const lines = runwayLines(ends);
  // Recommended-landing runway decoration: a green threshold bar at the landing
  // threshold and a green arrow running along the runway in the landing
  // direction (threshold -> far/rollout end), so the diagram reads like the
  // real runway (land toward the designator's heading).
  const recRunway = rec
    ? (() => {
        const h = rec.heading;
        const [fx, fy] = compassPoint(C, C, R - 20, h); // far (rollout) end
        const [tx, ty] = compassPoint(C, C, R - 20, (h + 180) % 360); // threshold
        const rad = (h * Math.PI) / 180;
        const px = Math.cos(rad); // unit vector perpendicular to the runway
        const py = Math.sin(rad);
        const half = 8;
        return {
          fx,
          fy,
          tx,
          ty,
          bx1: tx - half * px,
          by1: ty - half * py,
          bx2: tx + half * px,
          by2: ty + half * py,
        };
      })()
    : null;
  // Arrow geometry is only meaningful for a fixed vector.
  const [ax, ay] = hasVector ? compassPoint(C, C, R - 1, wdir) : [0, 0];
  const [hx, hy] = hasVector ? compassPoint(C, C, 34, wdir) : [0, 0];
  const [lx, ly] = hasVector ? compassPoint(C, C, R - 1, wdir) : [0, 0];

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
      <SectionHeading
        className="text-center text-xl font-normal"
        linkTitle={
          icao ? `${t("windComponents")} - ${icao}` : t("windComponents")
        }
      >
        {t("windComponents")}
      </SectionHeading>

      <div className="mt-3 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <svg
          viewBox="0 0 240 240"
          className="h-52 w-52 flex-shrink-0"
          role="img"
          aria-label={`${t("windComponents")} - ${t("wind")} ${
            hasVector
              ? `${wdir}° ${wspd} kt`
              : isCalm
                ? t("calm")
                : `${t("variable")} ${wspd} kt`
          }`}
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
            <marker
              id="rwy-dir"
              markerWidth="7"
              markerHeight="7"
              refX="4.5"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#16a34a" />
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

          {/* Recommended landing runway: green threshold bar + a green arrow in
              the landing direction (threshold -> rollout end). */}
          {recRunway && (
            <>
              <line
                x1={recRunway.tx}
                y1={recRunway.ty}
                x2={recRunway.fx}
                y2={recRunway.fy}
                stroke="#16a34a"
                strokeWidth="4"
                markerEnd="url(#rwy-dir)"
              />
              <line
                x1={recRunway.bx1}
                y1={recRunway.by1}
                x2={recRunway.bx2}
                y2={recRunway.by2}
                stroke="#16a34a"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Runway end designators, placed at their PHYSICAL THRESHOLD - the
              reciprocal end. When you land on 06 you touch down at the SW end,
              where the "06" numbers are painted on the pavement, so "06" sits SW
              (bearing 240), not at its heading bearing 060 (ICAO Annex 14 runway
              markings). The recommended landing end is highlighted green. */}
          {ends.map((e) => {
            const [x, y] = compassPoint(C, C, R - 34, (e.heading + 180) % 360);
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

          {/* wind arrow (from the wind source toward the centre) + label -
              only for a fixed vector; VRB/calm show a centre label instead */}
          {hasVector ? (
            <>
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
            </>
          ) : (
            <text
              x={C}
              y={C}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight={600}
              fill="#2d6a9a"
            >
              {isCalm ? t("calm") : `${t("variable")} ${wspd} kt`}
            </text>
          )}
        </svg>

        <div className="w-full max-w-xs">
          {!hasVector ? (
            isCalm ? (
              <p className="text-drossgray-dark text-sm">{t("calm")}</p>
            ) : (
              // Variable wind: the direction is undefined, so the crosswind on
              // any runway can reach the full wind speed.
              <p className="text-sm">
                <span className="text-amber-700">
                  {t("crosswind")} ≤ {wspd} kt
                </span>{" "}
                <span className="text-drossgray-dark">({t("variable")})</span>
              </p>
            )
          ) : (
            <>
              {rec && (
                <p className="mb-2 text-sm">
                  <span className="text-drossgray-dark">
                    {t("landingDirection")}:{" "}
                  </span>
                  <span className="font-semibold text-green-700">
                    {rec.ident}
                  </span>
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
                              w.headwind >= 0
                                ? "text-green-700"
                                : "text-red-600"
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}

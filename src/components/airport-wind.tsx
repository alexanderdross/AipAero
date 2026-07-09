import { getTranslations } from "next-intl/server";
import { compassPoint, runwayWinds } from "~/lib/crosswind";
import type { Metar } from "~/lib/weather";
import type { RunwayFact } from "~/server/db/schema";

const C = 100; // centre
const R = 86; // compass radius

// Distinct physical runway lines (through the centre) for the diagram.
function runwayLines(
  runways: RunwayFact[],
): [number, number, number, number][] {
  const seen = new Set<number>();
  const lines: [number, number, number, number][] = [];
  for (const r of runways) {
    const m = /^(\d{1,2})/.exec(r.ident.trim());
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (n < 1 || n > 36) continue;
    const h = (n * 10) % 180; // fold reciprocals onto the same line
    if (seen.has(h)) continue;
    seen.add(h);
    const [x1, y1] = compassPoint(C, C, R - 8, n * 10);
    const [x2, y2] = compassPoint(C, C, R - 8, (n * 10 + 180) % 360);
    lines.push([x1, y1, x2, y2]);
  }
  return lines;
}

/**
 * Wind-components box: head/tail- and cross-wind per runway end, computed from
 * the field's own reported wind and the runway bearings (`~/lib/crosswind`).
 * Server-rendered, including a compass SVG (runways + wind arrow) - no client JS.
 * Renders nothing without a numeric wind direction (VRB is skipped) or runways.
 */
export async function AirportWind({
  metar,
  runways,
}: {
  metar: Metar | null;
  runways: RunwayFact[];
}) {
  const wdir = typeof metar?.wdir === "number" ? metar.wdir : null;
  const wspd = metar?.wspd ?? null;
  if (wdir == null || wspd == null || wspd <= 0 || runways.length === 0)
    return null;

  const winds = runwayWinds(runways, wdir, wspd);
  if (winds.length === 0) return null;

  const t = await getTranslations("Weather");

  const [ax, ay] = compassPoint(C, C, R, wdir); // arrow tail (wind source)
  const [hx, hy] = compassPoint(C, C, 22, wdir); // arrow head (toward centre)
  const lines = runwayLines(runways);

  return (
    <section className="border border-[#ccc] bg-white p-4">
      <h2 className="text-center text-xl font-normal">{t("windComponents")}</h2>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
        <svg
          viewBox="0 0 200 200"
          className="h-44 w-44 flex-shrink-0"
          role="img"
          aria-label={`${t("windComponents")} - ${wdir}° ${wspd} kt`}
        >
          <defs>
            <marker
              id="wind-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="4"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#2d6a9a" />
            </marker>
          </defs>
          <circle cx={C} cy={C} r={R + 6} fill="none" stroke="#ccc" />
          <text x={C} y="16" textAnchor="middle" fontSize="13" fill="#626262">
            N
          </text>
          {lines.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="butt"
            />
          ))}
          <line
            x1={ax}
            y1={ay}
            x2={hx}
            y2={hy}
            stroke="#2d6a9a"
            strokeWidth="3"
            markerEnd="url(#wind-arrow)"
          />
        </svg>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {winds.map((w) => (
            <div key={w.ident} className="contents">
              <dt className="text-drossgray-dark font-mono">{w.ident}</dt>
              <dd>
                {w.headwind >= 0
                  ? `${t("headwind")} ${w.headwind} kt`
                  : `${t("tailwind")} ${Math.abs(w.headwind)} kt`}
                {w.crosswind > 0 && (
                  <>
                    {" · "}
                    {t("crosswind")} {w.crosswind} kt{" "}
                    {t(w.crosswindSide === "left" ? "fromLeft" : "fromRight")}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

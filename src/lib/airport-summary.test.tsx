import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAirportSummary } from "~/lib/airport-summary";

// A fake next-intl translator: echoes `key(values)` so the test can assert
// exactly which clauses were composed and with what interpolations, without
// pulling in the real ICU runtime. Function-valued args (the markup tag
// handlers) are skipped so the echo stays about the data interpolations.
const echo = (key: string, values?: Record<string, unknown>) => {
  const args = values
    ? Object.entries(values)
        .filter(([, v]) => typeof v !== "function")
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(",")
    : "";
  return `[${key}${args ? `(${args})` : ""}]`;
};
const fakeT = Object.assign(echo, { rich: echo });

// Identity tag handlers - the real ones wrap "AIP"/"AIRAC" in a link; here they
// just pass the chunk through so the render is inspectable as plain text.
const links = {
  glossary: (chunks: React.ReactNode) => chunks,
  guides: (chunks: React.ReactNode) => chunks,
};

const render = (out: React.ReactNode) => renderToStaticMarkup(<>{out}</>);

describe("buildAirportSummary", () => {
  it("includes town, runway count and AIRAC-dated chart clause when all present", () => {
    const out = buildAirportSummary(
      fakeT,
      {
        name: "Frankfurt",
        icao: "EDDF",
        type: "vfr",
        town: "Frankfurt am Main",
        runwayCount: 4,
        hasChart: true,
        airac: "10 July 2026",
      },
      links,
    );
    expect(render(out)).toBe(
      "[identityTown(place=Frankfurt (EDDF),town=Frankfurt am Main)] " +
        "[runways(count=4)] " +
        "[chartsAirac(type=VFR,airac=10 July 2026)]",
    );
  });

  it("uses the town-less identity and the dateless chart clause", () => {
    const out = buildAirportSummary(
      fakeT,
      {
        name: "Some Field",
        icao: "EDXX",
        type: "ifr",
        town: null,
        runwayCount: 1,
        hasChart: true,
        airac: null,
      },
      links,
    );
    expect(render(out)).toBe(
      "[identity(place=Some Field (EDXX))] [runways(count=1)] [charts(type=IFR)]",
    );
  });

  it("omits the runway clause when the count is zero and uses noCharts", () => {
    const out = buildAirportSummary(
      fakeT,
      {
        name: "Grass Strip",
        icao: null,
        type: "vfr",
        town: "Nowhere",
        runwayCount: 0,
        hasChart: false,
        airac: null,
      },
      links,
    );
    // ICAO-less field: the place is just the name (no parenthesised code).
    expect(render(out)).toBe(
      "[identityTown(place=Grass Strip,town=Nowhere)] [noCharts]",
    );
  });

  it("maps each aerodrome type to its chart-type token", () => {
    const heli = buildAirportSummary(
      fakeT,
      {
        name: "H",
        icao: "EDH1",
        type: "heliport",
        town: null,
        runwayCount: 0,
        hasChart: true,
        airac: null,
      },
      links,
    );
    expect(render(heli)).toContain("charts(type=heliport)");
    const mil = buildAirportSummary(
      fakeT,
      {
        name: "M",
        icao: "LF01",
        type: "mil",
        town: null,
        runwayCount: 0,
        hasChart: true,
        airac: null,
      },
      links,
    );
    expect(render(mil)).toContain("charts(type=military)");
  });
});

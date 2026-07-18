import { describe, expect, it } from "vitest";
import { buildAirportSummary } from "~/lib/airport-summary";

// A fake next-intl translator: echoes `key(values)` so the test can assert
// exactly which clauses were composed and with what interpolations, without
// pulling in the real ICU runtime.
const fakeT = (key: string, values?: Record<string, string | number>) => {
  const args = values
    ? Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : "";
  return `[${key}${args ? `(${args})` : ""}]`;
};

describe("buildAirportSummary", () => {
  it("includes town, runway count and AIRAC-dated chart clause when all present", () => {
    const out = buildAirportSummary(fakeT, {
      name: "Frankfurt",
      icao: "EDDF",
      type: "vfr",
      town: "Frankfurt am Main",
      runwayCount: 4,
      hasChart: true,
      airac: "10 July 2026",
    });
    expect(out).toBe(
      "[identityTown(place=Frankfurt (EDDF),town=Frankfurt am Main)] " +
        "[runways(count=4)] " +
        "[chartsAirac(type=VFR,airac=10 July 2026)]",
    );
  });

  it("uses the town-less identity and the dateless chart clause", () => {
    const out = buildAirportSummary(fakeT, {
      name: "Some Field",
      icao: "EDXX",
      type: "ifr",
      town: null,
      runwayCount: 1,
      hasChart: true,
      airac: null,
    });
    expect(out).toBe(
      "[identity(place=Some Field (EDXX))] [runways(count=1)] [charts(type=IFR)]",
    );
  });

  it("omits the runway clause when the count is zero and uses noCharts", () => {
    const out = buildAirportSummary(fakeT, {
      name: "Grass Strip",
      icao: null,
      type: "vfr",
      town: "Nowhere",
      runwayCount: 0,
      hasChart: false,
      airac: null,
    });
    // ICAO-less field: the place is just the name (no parenthesised code).
    expect(out).toBe(
      "[identityTown(place=Grass Strip,town=Nowhere)] [noCharts]",
    );
  });

  it("maps each aerodrome type to its chart-type token", () => {
    const heli = buildAirportSummary(fakeT, {
      name: "H",
      icao: "EDH1",
      type: "heliport",
      town: null,
      runwayCount: 0,
      hasChart: true,
      airac: null,
    });
    expect(heli).toContain("charts(type=heliport)");
    const mil = buildAirportSummary(fakeT, {
      name: "M",
      icao: "LF01",
      type: "mil",
      town: null,
      runwayCount: 0,
      hasChart: true,
      airac: null,
    });
    expect(mil).toContain("charts(type=military)");
  });
});

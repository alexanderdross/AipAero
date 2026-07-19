import { describe, expect, it } from "vitest";
import {
  buildRunwayStrips,
  parseRunwayEnds,
  surfaceColor,
} from "~/lib/runway-diagram";

describe("surfaceColor", () => {
  it("maps paved / grass / gravel / water / unknown to distinct colours", () => {
    expect(surfaceColor("ASP")).toBe("#52606d");
    expect(surfaceColor("Asphalt")).toBe("#52606d");
    expect(surfaceColor("Concrete")).toBe("#52606d");
    expect(surfaceColor("GRASS")).toBe("#4d7c0f");
    expect(surfaceColor("turf")).toBe("#4d7c0f");
    expect(surfaceColor("Gravel")).toBe("#b45309");
    expect(surfaceColor("water")).toBe("#0369a1");
    expect(surfaceColor(null)).toBe("#6b7280");
    expect(surfaceColor("mystery")).toBe("#6b7280");
  });
});

describe("parseRunwayEnds", () => {
  it("parses both ends with bearing = n*10", () => {
    expect(parseRunwayEnds("06/24")).toEqual([
      { label: "06", heading: 60 },
      { label: "24", heading: 240 },
    ]);
  });
  it("keeps the L/R suffix and dedupes", () => {
    expect(parseRunwayEnds("09L/27R")).toEqual([
      { label: "09L", heading: 90 },
      { label: "27R", heading: 270 },
    ]);
  });
  it("ignores non-numeric / out-of-range tokens", () => {
    expect(parseRunwayEnds("H1/H2")).toEqual([]);
    expect(parseRunwayEnds("40/99")).toEqual([]);
  });
});

describe("buildRunwayStrips", () => {
  const rwy = (
    ident: string,
    lengthFt: number | null,
    surface: string | null,
  ) => ({ ident, lengthFt, widthFt: null, surface }) as const;

  it("scales runways relative to the longest and folds the bearing to 0..179", () => {
    const strips = buildRunwayStrips([
      rwy("09/27", 8000, "ASP"),
      rwy("18/36", 4000, "GRASS"),
    ]);
    expect(strips).toHaveLength(2);
    expect(strips[0]!.scale).toBe(1); // longest
    expect(strips[0]!.color).toBe("#52606d");
    expect(strips[0]!.bearing).toBe(90);
    expect(strips[1]!.scale).toBe(0.5); // 4000/8000
    expect(strips[1]!.color).toBe("#4d7c0f");
    expect(strips[1]!.bearing).toBe(0); // 180 % 180
  });

  it("gives a neutral mid-length to runways with no published length", () => {
    const strips = buildRunwayStrips([rwy("06/24", null, "grass")]);
    expect(strips[0]!.scale).toBe(0.7);
  });

  it("floors very short runways so they stay visible", () => {
    const strips = buildRunwayStrips([
      rwy("09/27", 10000, "ASP"),
      rwy("03/21", 500, "GRASS"),
    ]);
    expect(strips[1]!.scale).toBe(0.4); // clamped up from 0.05
  });

  it("drops runways with no parseable end", () => {
    expect(buildRunwayStrips([rwy("XX/YY", 3000, "ASP")])).toEqual([]);
  });
});

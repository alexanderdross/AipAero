import { describe, it, expect } from "vitest";
import { factsOverride, factsOverrides } from "./facts-overrides";

describe("factsOverride", () => {
  it("returns the verified override for a seeded ICAO", () => {
    expect(factsOverride("EDPE")).toEqual({
      street: "Flugplatz 1",
      postcode: "85072",
      municipality: "Eichstätt",
      lat: 48.8785232,
      lon: 11.1798629,
    });
  });

  it("is case-insensitive on the ICAO key", () => {
    expect(factsOverride("edpe")).toEqual(factsOverrides.EDPE);
  });

  it("returns undefined for an unseeded or missing ICAO", () => {
    expect(factsOverride("EDDF")).toBeUndefined();
    expect(factsOverride(null)).toBeUndefined();
    expect(factsOverride(undefined)).toBeUndefined();
    expect(factsOverride("")).toBeUndefined();
  });
});

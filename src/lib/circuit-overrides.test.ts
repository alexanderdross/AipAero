import { describe, expect, it } from "vitest";
import { circuitOverride, circuitOverrides } from "~/lib/circuit-overrides";

describe("circuitOverride", () => {
  it("returns null when there is no override (map is seeded empty)", () => {
    expect(circuitOverride("EDNY", "06/24")).toBeNull();
    expect(circuitOverride(null, "06/24")).toBeNull();
    expect(circuitOverride("EDNY", null)).toBeNull();
    expect(circuitOverride(undefined, undefined)).toBeNull();
  });

  it("returns the verified direction for a matching ICAO + runway ident", () => {
    // Inject a temporary entry to exercise the lookup without seeding real,
    // safety-critical data into the shipped map.
    circuitOverrides.TEST = { "07/25": "right", "16/34": "left" };
    try {
      expect(circuitOverride("test", "07/25")).toBe("right"); // ICAO case-insensitive
      expect(circuitOverride("TEST", " 07/25 ")).toBe("right"); // ident trimmed
      expect(circuitOverride("TEST", "16/34")).toBe("left");
      expect(circuitOverride("TEST", "09/27")).toBeNull(); // runway not overridden
      expect(circuitOverride("EDXX", "07/25")).toBeNull(); // ICAO not overridden
    } finally {
      delete circuitOverrides.TEST;
    }
  });
});

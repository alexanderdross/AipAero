import { describe, it, expect } from "vitest";
import { addressOverride, addressOverrides } from "./address-overrides";

describe("addressOverride", () => {
  it("returns the verified address for a seeded ICAO", () => {
    expect(addressOverride("EDPE")).toEqual({
      street: "Flugplatz 1",
      postcode: "85072",
      city: "Eichstätt",
    });
  });

  it("is case-insensitive on the ICAO key", () => {
    expect(addressOverride("edpe")).toEqual(addressOverrides.EDPE);
  });

  it("returns undefined for an unseeded or missing ICAO", () => {
    expect(addressOverride("EDDF")).toBeUndefined();
    expect(addressOverride(null)).toBeUndefined();
    expect(addressOverride(undefined)).toBeUndefined();
    expect(addressOverride("")).toBeUndefined();
  });
});

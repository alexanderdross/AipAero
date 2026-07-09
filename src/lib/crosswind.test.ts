import { describe, expect, it } from "vitest";
import { recommendedLanding, runwayWinds } from "~/lib/crosswind";
import type { RunwayFact } from "~/server/db/schema";

const rwy = (ident: string): RunwayFact => ({
  ident,
  lengthFt: null,
  widthFt: null,
  surface: null,
});

describe("runwayWinds", () => {
  it("splits a 090/10kt wind on RWY 06/24 into head/cross components", () => {
    const winds = runwayWinds([rwy("06/24")], 90, 10);
    const w06 = winds.find((w) => w.ident === "06")!;
    const w24 = winds.find((w) => w.ident === "24")!;
    // wind from 090 on RWY 06 (heading 060): 30° off -> headwind cos30*10≈9,
    // crosswind sin30*10=5 from the right.
    expect(w06.headwind).toBe(9);
    expect(w06.crosswind).toBe(5);
    expect(w06.crosswindSide).toBe("right");
    // reciprocal 24 (240°): tailwind, crosswind from the left.
    expect(w24.headwind).toBe(-9);
    expect(w24.crosswind).toBe(5);
    expect(w24.crosswindSide).toBe("left");
  });
});

describe("recommendedLanding", () => {
  it("picks the runway end most into wind (highest headwind)", () => {
    const winds = runwayWinds([rwy("06/24")], 90, 10);
    expect(recommendedLanding(winds)?.ident).toBe("06");
  });

  it("returns null when no end has a positive headwind (pure crosswind)", () => {
    // wind from 150 on RWY 06/24 (060/240): exactly 90° off both ends.
    const winds = runwayWinds([rwy("06/24")], 150, 10);
    expect(winds.every((w) => w.headwind === 0)).toBe(true);
    expect(recommendedLanding(winds)).toBeNull();
  });
});

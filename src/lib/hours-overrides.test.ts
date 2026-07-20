import { describe, expect, it } from "vitest";
import { hoursOverride, resolveOverrideHours } from "~/lib/hours-overrides";
import { openStatus } from "~/lib/opening-hours";

const EDNY_COORDS = { lat: 47.67, lon: 9.51 };

describe("hoursOverride", () => {
  it("returns null for fields without an override", () => {
    expect(hoursOverride("EDDF")).toBeNull();
    expect(hoursOverride(null)).toBeNull();
    expect(hoursOverride(undefined)).toBeNull();
  });

  it("EDNY carries winter + summer UTC windows and Europe/Berlin", () => {
    const ov = hoursOverride("edny"); // case-insensitive
    expect(ov).not.toBeNull();
    expect(ov!.tz).toBe("Europe/Berlin");
    expect(ov!.winter).toHaveLength(7);
    expect(ov!.summer).toHaveLength(7);
    // Winter Mon-Fri 05:00-21:00Z (300-1260).
    expect(ov!.winter[0]).toEqual({
      kind: "window",
      open: { t: "time", m: 300 },
      close: { t: "time", m: 1260 },
    });
    // Summer Mon-Fri 04:00-20:00Z (240-1200).
    expect(ov!.summer![0]).toEqual({
      kind: "window",
      open: { t: "time", m: 240 },
      close: { t: "time", m: 1200 },
    });
    // Weekend: 08:00Z-sunset winter, 07:00Z-sunset summer.
    expect(ov!.winter[5]).toEqual({
      kind: "window",
      open: { t: "time", m: 480 },
      close: { t: "ss" },
    });
    expect(ov!.summer![5]).toEqual({
      kind: "window",
      open: { t: "time", m: 420 },
      close: { t: "ss" },
    });
  });
});

describe("resolveOverrideHours (season selection, always UTC)", () => {
  it("returns null for fields without an override", () => {
    expect(resolveOverrideHours("EDDF")).toBeNull();
    expect(resolveOverrideHours(null)).toBeNull();
  });

  it("picks the WINTER window in January", () => {
    const jan = new Date("2026-01-14T12:00:00Z");
    const h = resolveOverrideHours("EDNY", jan)!;
    expect(h[0]).toEqual({
      kind: "window",
      open: { t: "time", m: 300 }, // 05:00Z
      close: { t: "time", m: 1260 }, // 21:00Z
    });
  });

  it("picks the SUMMER window in July", () => {
    const jul = new Date("2026-07-14T12:00:00Z");
    const h = resolveOverrideHours("EDNY", jul)!;
    expect(h[0]).toEqual({
      kind: "window",
      open: { t: "time", m: 240 }, // 04:00Z
      close: { t: "time", m: 1200 }, // 20:00Z
    });
  });
});

describe("EDNY badge is season-correct in UTC (openStatus, no tz)", () => {
  // Winter (CET): open 05:00-21:00Z. 2026-01-14 is a Wednesday.
  it("winter: open at 20:30Z, closes 21:00Z", () => {
    const when = new Date("2026-01-14T20:30:00Z");
    const s = openStatus(resolveOverrideHours("EDNY", when), EDNY_COORDS, when);
    expect(s.state).toBe("open");
    expect(s.closesAt).toBe(1260); // 21:00Z
  });

  it("winter: closed at 21:30Z", () => {
    const when = new Date("2026-01-14T21:30:00Z");
    expect(
      openStatus(resolveOverrideHours("EDNY", when), EDNY_COORDS, when).state,
    ).toBe("closed");
  });

  // Summer (CEST): open 04:00-20:00Z. 2026-07-15 is a Wednesday.
  it("summer: closed at 20:30Z (the winter model would wrongly say open)", () => {
    const when = new Date("2026-07-15T20:30:00Z");
    const s = openStatus(resolveOverrideHours("EDNY", when), EDNY_COORDS, when);
    expect(s.state).toBe("closed");
  });

  it("summer: open at 19:30Z, closes 20:00Z", () => {
    const when = new Date("2026-07-15T19:30:00Z");
    const s = openStatus(resolveOverrideHours("EDNY", when), EDNY_COORDS, when);
    expect(s.state).toBe("open");
    expect(s.closesAt).toBe(1200); // 20:00Z
  });
});

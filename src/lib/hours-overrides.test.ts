import { describe, expect, it } from "vitest";
import { hoursOverride } from "~/lib/hours-overrides";
import { openStatus } from "~/lib/opening-hours";

const EDNY_COORDS = { lat: 47.67, lon: 9.51 };

describe("hoursOverride", () => {
  it("returns null for fields without an override", () => {
    expect(hoursOverride("EDDF")).toBeNull();
    expect(hoursOverride(null)).toBeNull();
    expect(hoursOverride(undefined)).toBeNull();
  });

  it("EDNY: LOCAL 06:00-22:00 Mon-Fri, 09:00-sunset Sat/Sun, tz Europe/Berlin", () => {
    const ov = hoursOverride("edny"); // case-insensitive
    expect(ov).not.toBeNull();
    expect(ov!.tz).toBe("Europe/Berlin");
    const h = ov!.hours;
    expect(h).toHaveLength(7);
    // Mon..Fri (index 0..4): 06:00-22:00 LOCAL
    for (let d = 0; d < 5; d++) {
      expect(h[d]).toEqual({
        kind: "window",
        open: { t: "time", m: 360 },
        close: { t: "time", m: 1320 },
      });
    }
    // Sat + Sun (index 5,6): 09:00 LOCAL open, sunset close
    for (const d of [5, 6]) {
      expect(h[d]).toEqual({
        kind: "window",
        open: { t: "time", m: 540 },
        close: { t: "ss" },
      });
    }
  });

  it("EDNY weekday window is open at 12:00 local on a Wednesday", () => {
    const ov = hoursOverride("EDNY")!;
    // 2024-01-03 is a Wednesday; 12:00 Europe/Berlin = 11:00Z in winter.
    const when = new Date("2024-01-03T11:00:00Z");
    const status = openStatus(ov.hours, EDNY_COORDS, when, ov.tz);
    expect(status.state).toBe("open");
    expect(status.closesAt).toBe(1320); // 22:00 local
  });

  // The DST regression: the same LOCAL instant must give the same answer in
  // BOTH winter and summer, even though the corresponding UTC hour differs by
  // one. A single stored UTC window could not do this (it would drift ~1 h).
  it("EDNY closes at 22:00 LOCAL in winter AND summer (no DST drift)", () => {
    const ov = hoursOverride("EDNY")!;
    // Winter (CET = UTC+1): 21:30 local Wed = 20:30Z.
    const winter = new Date("2024-01-03T20:30:00Z");
    // Summer (CEST = UTC+2): 21:30 local Wed = 19:30Z.
    const summer = new Date("2024-07-03T19:30:00Z");
    for (const when of [winter, summer]) {
      const status = openStatus(ov.hours, EDNY_COORDS, when, ov.tz);
      expect(status.state).toBe("open");
      expect(status.closesAt).toBe(1320); // 22:00 local, both seasons
    }
  });

  it("EDNY is closed at 22:30 LOCAL in both seasons", () => {
    const ov = hoursOverride("EDNY")!;
    const winter = new Date("2024-01-03T21:30:00Z"); // 22:30 CET
    const summer = new Date("2024-07-03T20:30:00Z"); // 22:30 CEST
    for (const when of [winter, summer]) {
      expect(openStatus(ov.hours, EDNY_COORDS, when, ov.tz).state).toBe(
        "closed",
      );
    }
  });
});

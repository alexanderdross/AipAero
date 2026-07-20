import { describe, expect, it } from "vitest";
import { hoursOverride } from "~/lib/hours-overrides";
import { openStatus } from "~/lib/opening-hours";

describe("hoursOverride", () => {
  it("returns null for fields without an override", () => {
    expect(hoursOverride("EDDF")).toBeNull();
    expect(hoursOverride(null)).toBeNull();
    expect(hoursOverride(undefined)).toBeNull();
  });

  it("EDNY: Mon-Fri 05:00-21:00Z fixed window, Sat/Sun 08:00Z-sunset", () => {
    const h = hoursOverride("edny"); // case-insensitive
    expect(h).not.toBeNull();
    expect(h).toHaveLength(7);
    // Mon..Fri (index 0..4)
    for (let d = 0; d < 5; d++) {
      expect(h![d]).toEqual({
        kind: "window",
        open: { t: "time", m: 300 },
        close: { t: "time", m: 1260 },
      });
    }
    // Sat + Sun (index 5,6): 08:00Z open, sunset close
    for (const d of [5, 6]) {
      expect(h![d]).toEqual({
        kind: "window",
        open: { t: "time", m: 480 },
        close: { t: "ss" },
      });
    }
  });

  it("EDNY weekday window is open at 12:00Z on a Wednesday (UTC eval)", () => {
    // 2024-01-03 is a Wednesday.
    const when = new Date("2024-01-03T12:00:00Z");
    const status = openStatus(
      hoursOverride("EDNY"),
      { lat: 47.67, lon: 9.51 },
      when,
    );
    expect(status.state).toBe("open");
    expect(status.closesAt).toBe(1260); // 21:00Z
  });
});

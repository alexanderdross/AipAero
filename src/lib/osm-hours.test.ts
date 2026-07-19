import { describe, expect, it } from "vitest";
import { parseOsmHours } from "~/lib/osm-hours";
import type { DayHours } from "~/lib/opening-hours";

// lon +15 => UTC offset +60 min, so local HH:MM -> (HH:MM - 60) UTC.
const coords = { lat: 48, lon: 15 };
const win = (openM: number, closeM: number): DayHours => ({
  kind: "window",
  open: { t: "time", m: openM },
  close: { t: "time", m: closeM },
});

describe("parseOsmHours", () => {
  it("returns null for empty / non-string / unusable input", () => {
    expect(parseOsmHours("", coords)).toBeNull();
    expect(parseOsmHours(null, coords)).toBeNull();
    expect(parseOsmHours('"by appointment"', coords)).toBeNull();
  });

  it("24/7 -> h24 every day", () => {
    expect(parseOsmHours("24/7", coords)).toEqual(
      Array(7).fill({ kind: "h24" }),
    );
  });

  it("Mo-Fr fixed window, converted local->UTC; weekend stays unknown", () => {
    // 08:00-18:00 local at lon +15 -> 07:00-17:00 UTC (420-1020).
    const r = parseOsmHours("Mo-Fr 08:00-18:00", coords)!;
    expect(r.slice(0, 5)).toEqual(Array(5).fill(win(420, 1020)));
    expect(r[5]).toEqual({ kind: "unknown" });
    expect(r[6]).toEqual({ kind: "unknown" });
  });

  it("multiple rules; later rule overrides; comment stripped", () => {
    const r = parseOsmHours(
      'Mo-Fr 08:00-18:00; Sa 09:00-13:00; Su off "PPR"',
      coords,
    )!;
    expect(r[4]).toEqual(win(420, 1020)); // Fri
    expect(r[5]).toEqual(win(480, 720)); // Sat 09:00-13:00 -> 08:00-12:00 UTC
    expect(r[6]).toEqual({ kind: "closed" }); // Su off
  });

  it("sunrise-sunset -> solar boundaries (offset-independent), all days", () => {
    const r = parseOsmHours("sunrise-sunset", coords)!;
    expect(r).toEqual(
      Array(7).fill({ kind: "window", open: { t: "sr" }, close: { t: "ss" } }),
    );
  });

  it("a bare time range with no day token applies to every day", () => {
    const r = parseOsmHours("08:00-18:00", coords)!;
    expect(r).toEqual(Array(7).fill(win(420, 1020)));
  });

  it("fixed times with no coords cannot be placed on UTC -> null (conservative)", () => {
    expect(parseOsmHours("Mo-Fr 08:00-18:00", null)).toBeNull();
    // ...but solar keywords still resolve without coords.
    expect(parseOsmHours("sunrise-sunset", null)).toEqual(
      Array(7).fill({ kind: "window", open: { t: "sr" }, close: { t: "ss" } }),
    );
  });

  it("unmodelled selectors (PH/week) are left unknown, not guessed", () => {
    // PH is not a weekday -> that rule is skipped; the Mo-Fr rule still applies.
    const r = parseOsmHours("Mo-Fr 08:00-18:00; PH off", coords)!;
    expect(r.slice(0, 5)).toEqual(Array(5).fill(win(420, 1020)));
    // A wholly-unmodelled string yields null.
    expect(parseOsmHours("week 01-20 Mo-Fr 08:00-18:00", coords)).toBeNull();
  });
});

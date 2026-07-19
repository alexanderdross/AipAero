import { describe, expect, it } from "vitest";
import {
  isOpenUntil,
  minutesToHhmm,
  openStatus,
  parseStructuredHours,
  structuredHoursToDisplay,
  toOpeningHoursSpecification,
  type DayHours,
  type StructuredHours,
} from "~/lib/opening-hours";

// OpenAIP hoursOfOperation fixtures follow the authoritative v1 airport schema:
// { operatingHours: [{ dayOfWeek 0..6, startTime?, endTime?, sunrise, sunset,
//   byNotam }], remarks? }

const fixed = (open: number, close: number): DayHours => ({
  kind: "window",
  open: { t: "time", m: open },
  close: { t: "time", m: close },
});
const allDays = (dh: DayHours): StructuredHours => new Array(7).fill(dh);

describe("parseStructuredHours", () => {
  it("maps a Mon-Fri fixed window with a sunrise/sunset weekend day", () => {
    const raw = {
      operatingHours: [
        { dayOfWeek: 0, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 1, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 2, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 4, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 5, sunrise: true, sunset: true },
      ],
    };
    const s = parseStructuredHours(raw)!;
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual(fixed(480, 1200));
    expect(s[5]).toEqual({
      kind: "window",
      open: { t: "sr" },
      close: { t: "ss" },
    });
    // Sunday not mentioned -> unknown, never "closed" from silence.
    expect(s[6]).toEqual({ kind: "unknown" });
  });

  it("maps byNotam to a notam day and returns null for no structure", () => {
    const s = parseStructuredHours({
      operatingHours: [{ dayOfWeek: 0, byNotam: true }],
    })!;
    expect(s[0]).toEqual({ kind: "notam" });
    expect(parseStructuredHours({ remarks: "see AIP" })).toBeNull();
    expect(parseStructuredHours("H24")).toBeNull();
    expect(parseStructuredHours(null)).toBeNull();
  });
});

describe("structuredHoursToDisplay", () => {
  it("groups consecutive identical days like the legacy display string", () => {
    const raw = {
      operatingHours: [
        { dayOfWeek: 0, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 1, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 2, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 4, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 5, sunrise: true, sunset: true },
      ],
    };
    expect(structuredHoursToDisplay(parseStructuredHours(raw)!)).toBe(
      "Mon-Fri 08:00-20:00; Sat SR-SS",
    );
  });
});

describe("openStatus", () => {
  const coords = { lat: 51.5, lon: 0 }; // Greenwich: local ~ UTC
  // 2026-07-06 is a Monday; 12:00Z is inside a 08:00-20:00 window.
  const monNoon = new Date("2026-07-06T12:00:00Z");
  const monEarly = new Date("2026-07-06T06:00:00Z");

  it("reports open with a closesAt during a fixed window", () => {
    const s = allDays(fixed(480, 1200)); // 08:00-20:00
    expect(openStatus(s, coords, monNoon)).toEqual({
      state: "open",
      closesAt: 1200,
    });
  });

  it("reports closed with opensAt before the window opens", () => {
    const s = allDays(fixed(480, 1200));
    expect(openStatus(s, coords, monEarly)).toEqual({
      state: "closed",
      opensAt: 480,
    });
  });

  it("is unknown for notam / unmentioned days (never a false open/closed)", () => {
    expect(openStatus(allDays({ kind: "notam" }), coords, monNoon).state).toBe(
      "unknown",
    );
    expect(
      openStatus(allDays({ kind: "unknown" }), coords, monNoon).state,
    ).toBe("unknown");
  });

  it("h24 is always open with no closesAt", () => {
    expect(openStatus(allDays({ kind: "h24" }), coords, monNoon)).toEqual({
      state: "open",
    });
  });

  it("resolves a sunset close from coordinates (open at noon, shut by 23:00)", () => {
    const s = allDays({
      kind: "window",
      open: { t: "time", m: 480 },
      close: { t: "ss" },
    });
    expect(openStatus(s, coords, monNoon).state).toBe("open");
    expect(openStatus(s, coords, new Date("2026-07-06T23:00:00Z")).state).toBe(
      "closed",
    );
  });

  it("approximates local time from longitude", () => {
    // lon +15 = +1h. At 18:00Z the field's local clock is 19:00.
    const east = { lat: 48, lon: 15 };
    const s = allDays(fixed(480, 1170)); // closes 19:30 local
    const at1800Z = new Date("2026-07-06T18:00:00Z");
    expect(openStatus(s, east, at1800Z)).toEqual({
      state: "open",
      closesAt: 1170,
    });
  });
});

describe("isOpenUntil", () => {
  const coords = { lat: 51.5, lon: 0 };
  const monday = new Date("2026-07-06T10:00:00Z");

  it("includes a field that closes exactly at the target time", () => {
    const s = allDays(fixed(480, 1140)); // 08:00-19:00
    expect(isOpenUntil(s, coords, 19 * 60, monday)).toBe(true); // 19:00 inclusive
    expect(isOpenUntil(s, coords, 19 * 60 + 1, monday)).toBe(false); // 19:01 too late
    expect(isOpenUntil(s, coords, 7 * 60, monday)).toBe(false); // before opening
  });

  it("excludes unknown / notam / closed days", () => {
    expect(
      isOpenUntil(allDays({ kind: "notam" }), coords, 19 * 60, monday),
    ).toBe(false);
    expect(
      isOpenUntil(allDays({ kind: "unknown" }), coords, 19 * 60, monday),
    ).toBe(false);
    expect(
      isOpenUntil(allDays({ kind: "closed" }), coords, 19 * 60, monday),
    ).toBe(false);
  });
});

describe("toOpeningHoursSpecification", () => {
  it("groups fixed days and omits solar/notam/unknown days", () => {
    const raw = {
      operatingHours: [
        { dayOfWeek: 0, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 1, startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: 5, sunrise: true, sunset: true }, // omitted (solar)
      ],
    };
    const spec = toOpeningHoursSpecification(parseStructuredHours(raw));
    expect(spec).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Monday", "https://schema.org/Tuesday"],
        opens: "08:00",
        closes: "20:00",
      },
    ]);
  });

  it("maps h24 to a full-day spec", () => {
    const spec = toOpeningHoursSpecification(allDays({ kind: "h24" }));
    expect(spec[0]!.opens).toBe("00:00");
    expect(spec[0]!.closes).toBe("23:59");
    expect(spec[0]!.dayOfWeek).toHaveLength(7);
  });
});

describe("minutesToHhmm", () => {
  it("formats minutes and end-of-day", () => {
    expect(minutesToHhmm(0)).toBe("00:00");
    expect(minutesToHhmm(485)).toBe("08:05");
    expect(minutesToHhmm(1200)).toBe("20:00");
    expect(minutesToHhmm(1440)).toBe("24:00");
  });
});

import { describe, expect, it } from "vitest";
import { mapOpenAipItem, parseOpeningHours } from "~/lib/openaip-parse";

// Fixtures follow the authoritative OpenAIP v1 airport response schema:
// https://api.core.openaip.net/api/schemas/response/airport/airport-schema.json

describe("mapOpenAipItem", () => {
  it("maps coordinates, elevation, runways and frequencies", () => {
    const facts = mapOpenAipItem({
      icaoCode: "EDNY",
      geometry: { coordinates: [9.5114, 47.6712] }, // [lon, lat]
      elevation: { value: 419.1, unit: 0 }, // metres -> feet
      runways: [
        {
          designator: "06",
          dimension: {
            length: { value: 2356, unit: 0 },
            width: { value: 45, unit: 0 },
          },
          surface: { mainComposite: 0 }, // Asphalt
          turnDirection: 1, // Left
        },
      ],
      frequencies: [
        { value: "120.075", type: 14, name: "TOWER" },
        { value: "128.180", type: 15 }, // no name -> label from type enum (ATIS)
      ],
    });

    expect(facts.lat).toBe(47.6712);
    expect(facts.lon).toBe(9.5114);
    expect(facts.elevationFt).toBe(1375); // round(419.1 * 3.28084)
    expect(facts.runways).toEqual([
      {
        ident: "06",
        lengthFt: 7730, // round(2356 * 3.28084)
        widthFt: 148,
        surface: "Asphalt",
        trafficPattern: "left",
      },
    ]);
    expect(facts.frequencies).toEqual([
      { type: "TOWER", description: "TOWER", mhz: "120.075" },
      { type: "ATIS", description: null, mhz: "128.180" },
    ]);
    expect(facts.source).toBe("openaip");
  });

  it("maps the fuelTypes integer enum to labels and skips unknown codes", () => {
    expect(mapOpenAipItem({ services: { fuelTypes: [1, 3] } }).fuel).toEqual([
      "AVGAS",
      "Jet A-1",
    ]);
    // 99 is not a documented code -> skipped rather than mislabelled
    expect(mapOpenAipItem({ services: { fuelTypes: [99] } }).fuel).toEqual([]);
  });

  it("maps turnDirection to a circuit direction (0=right, 1=left, 2/other=null)", () => {
    const dir = (turnDirection: number) =>
      mapOpenAipItem({ runways: [{ designator: "09", turnDirection }] })
        .runways[0]!.trafficPattern;
    expect(dir(0)).toBe("right");
    expect(dir(1)).toBe("left");
    expect(dir(2)).toBeNull(); // "Both" is ambiguous -> omitted
  });

  it("reads ppr as a boolean", () => {
    expect(mapOpenAipItem({ ppr: true }).ppr).toBe(true);
    expect(mapOpenAipItem({ ppr: false }).ppr).toBe(false);
    expect(mapOpenAipItem({}).ppr).toBeNull();
  });
});

describe("parseOpeningHours", () => {
  const day = (
    dayOfWeek: number,
    startTime: string | null,
    endTime: string | null,
    extra: Record<string, unknown> = {},
  ) => ({
    dayOfWeek,
    startTime,
    endTime,
    sunrise: false,
    sunset: false,
    byNotam: false,
    ...extra,
  });

  it("groups consecutive days with identical hours", () => {
    const operatingHours = [
      day(0, "08:00", "20:00"),
      day(1, "08:00", "20:00"),
      day(2, "08:00", "20:00"),
      day(3, "08:00", "20:00"),
      day(4, "08:00", "20:00"),
      day(5, null, null, { sunrise: true, sunset: true }),
    ];
    expect(parseOpeningHours({ operatingHours })).toBe(
      "Mon-Fri 08:00-20:00; Sat SR-SS",
    );
  });

  it("renders sunrise/sunset and by-NOTAM windows, trims seconds", () => {
    expect(
      parseOpeningHours({
        operatingHours: [day(6, "09:00:00", null, { sunset: true })],
      }),
    ).toBe("Sun 09:00-SS");
    expect(
      parseOpeningHours({
        operatingHours: [day(0, null, null, { byNotam: true })],
      }),
    ).toBe("Mon by NOTAM");
  });

  it("omits days without a usable window and fails soft on junk", () => {
    expect(
      parseOpeningHours({ operatingHours: [day(0, null, null)] }),
    ).toBeNull();
    expect(parseOpeningHours(null)).toBeNull();
    expect(parseOpeningHours(42)).toBeNull();
    // a plain string passes through (OSM fallback shape)
    expect(parseOpeningHours("H24")).toBe("H24");
  });
});

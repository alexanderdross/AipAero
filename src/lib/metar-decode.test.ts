import { describe, expect, it } from "vitest";
import { decodeReport } from "~/lib/metar-decode";

// Helper: the decoded text for the given raw token (first match).
function textFor(raw: string, token: string, lang = "en") {
  return decodeReport(raw, lang).find((l) => l.token === token)?.text;
}

describe("decodeReport", () => {
  const metar = "METAR EDNY 090950Z 06004KT 9999 FEW044 25/14 Q1017";

  it("returns [] for empty input", () => {
    expect(decodeReport("", "en")).toEqual([]);
    expect(decodeReport(null, "en")).toEqual([]);
  });

  it("decodes the station, wind, visibility, clouds, temp and QNH (EDNY METAR)", () => {
    expect(textFor(metar, "EDNY")).toBe("Station: EDNY");
    expect(textFor(metar, "06004KT")).toBe("Wind from 60° at 4 kt");
    expect(textFor(metar, "9999")).toBe("Visibility: 10 km or more");
    expect(textFor(metar, "FEW044")).toBe("Few clouds at 4400 ft");
    expect(textFor(metar, "25/14")).toBe("Temperature 25 °C, dew point 14 °C");
    expect(textFor(metar, "Q1017")).toBe("QNH 1017 hPa");
  });

  it("localizes to German", () => {
    expect(textFor(metar, "06004KT", "de")).toBe("Wind aus 60° um 4 kt");
    expect(textFor(metar, "Q1017", "de")).toBe("QNH 1017 hPa");
  });

  it("handles calm wind, gusts, negative temps and CAVOK", () => {
    expect(textFor("00000KT", "00000KT")).toBe("Wind calm");
    expect(textFor("28015G27KT", "28015G27KT")).toBe(
      "Wind from 280° at 15 kt, gusting 27 kt",
    );
    expect(textFor("M02/M05", "M02/M05")).toBe(
      "Temperature -2 °C, dew point -5 °C",
    );
    expect(textFor("CAVOK", "CAVOK")).toContain("CAVOK");
  });

  it("decodes present weather groups", () => {
    expect(textFor("-SHRA", "-SHRA")).toBe("Light showers of rain");
    expect(textFor("+TSRA", "+TSRA")).toBe("Heavy thunderstorm rain");
    expect(textFor("BKN012", "BKN012")).toBe("Broken clouds at 1200 ft");
  });

  it("decodes TAF validity and change groups", () => {
    const taf =
      "TAF EDNY 090800Z 0909/0918 04005KT CAVOK TEMPO 0909/0915 VRB03KT";
    expect(textFor(taf, "0909/0918")).toBe(
      "Valid from 9. 09:00 to 9. 18:00 UTC",
    );
    expect(textFor(taf, "TEMPO")).toBe("Temporarily:");
    expect(textFor(taf, "VRB03KT")).toBe("Wind variable at 3 kt");
  });

  it("keeps unrecognized tokens visible with empty text", () => {
    const lines = decodeReport("METAR EDNY 090950Z XYZ123", "en");
    const unknown = lines.find((l) => l.token === "XYZ123");
    expect(unknown).toBeDefined();
    expect(unknown?.text).toBe("");
  });
});

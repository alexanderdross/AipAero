import { describe, expect, it } from "vitest";
import {
  airacDateFromUrl,
  chartDisplayName,
  chartTypeLabel,
  cleanChartName,
  parseCharts,
} from "./charts";

describe("parseCharts", () => {
  it("parses a valid chart list", () => {
    const raw = JSON.stringify([
      { name: "AD 2.EGPD-2-1", url: "https://x/1.pdf" },
      { name: "EHAM-VFR-PROC", url: "https://x/2.pdf" },
    ]);
    expect(parseCharts(raw)).toHaveLength(2);
    expect(parseCharts(raw)[0]!.name).toBe("AD 2.EGPD-2-1");
  });

  it("is fail-soft on garbage", () => {
    expect(parseCharts(null)).toEqual([]);
    expect(parseCharts("")).toEqual([]);
    expect(parseCharts("not json")).toEqual([]);
    expect(parseCharts('{"name":"x"}')).toEqual([]);
    expect(parseCharts('[{"name":1,"url":2}]')).toEqual([]);
  });
});

describe("airacDateFromUrl", () => {
  it("parses every live source's URL format", () => {
    // UK / NO
    expect(
      airacDateFromUrl(
        "https://www.aurora.nats.co.uk/htmlAIP/Publications/2026-07-09-AIRAC/graphics/488432.pdf",
      ),
    ).toBe("2026-07-09");
    // FR
    expect(
      airacDateFromUrl(
        "https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_09_JUL_2026/FRANCE/AIRAC-2026-07-09/html/eAIP/Cartes/LFBA/AD_2_LFBA_ADC_01.pdf",
      ),
    ).toBe("2026-07-09");
    // NL / SE / PL edition folders
    expect(
      airacDateFromUrl(
        "https://eaip.lvnl.nl/web/eaip/AIRAC AMDT 07-2026_2026_07_09/documents/Root_WePub/Charts/AD/EHAL/EHAL-VFR-PROC.pdf",
      ),
    ).toBe("2026-07-09");
    expect(
      airacDateFromUrl(
        "https://aro.lfv.se/content/eaip/AIRAC AIP AMDT 4-2026_2026_06_11/documents/Root/SWEDEN/Charts/AD/ESNX/9. VAC/ESNX VAC.pdf",
      ),
    ).toBe("2026-06-11");
    // AT (yymmdd path segment)
    expect(
      airacDateFromUrl(
        "https://eaip.austrocontrol.at/lo/260710/Charts/LOWG/LO_AD_2_LOWG_1-1_en.pdf",
      ),
    ).toBe("2026-07-10");
    // DE edition (BasicVFR page URL)
    expect(
      airacDateFromUrl(
        "https://aip.dfs.de/BasicVFR/2026JUN25/chapter/3fb9780db947a5bd4782bc7f9b334f99.html",
      ),
    ).toBe("2026-06-25");
    // CZ carries no date in its URLs
    expect(
      airacDateFromUrl("https://aim.rlp.cz/eaip/graphics/a2-tb-adc.pdf"),
    ).toBeNull();
    expect(airacDateFromUrl(null)).toBeNull();
  });
});

describe("chartTypeLabel", () => {
  it("expands a leading designator token (ES-style names)", () => {
    expect(chartTypeLabel("IAC 7", "en")).toBe("Instrument Approach Chart");
    expect(chartTypeLabel("AOC 1", "en")).toBe("Aerodrome Obstacle Chart");
    expect(chartTypeLabel("SID 5", "en")).toBe("Standard Instrument Departure");
  });

  it("localises to the request language, with English fallback", () => {
    expect(chartTypeLabel("VAC 1", "de")).toBe("Sichtanflugkarte");
    expect(chartTypeLabel("VAC 1", "fr")).toBe("Carte d'approche à vue");
    // A locale with no dedicated entry falls back to English.
    expect(chartTypeLabel("VAC 1", "is")).toBe("Visual Approach Chart");
  });

  it("matches a designator as a whole token anywhere in the name", () => {
    // Space-separated (SE ESNX style) and underscore/filename (IS) forms.
    expect(chartTypeLabel("ESNX VAC", "en")).toBe("Visual Approach Chart");
    expect(chartTypeLabel("BIKF_8_VFR_RWY_01", "en")).toBe("VFR Chart");
  });

  it("expands the source codes verified against the ENAIRE chart titles", () => {
    // PDC = "Plano de Estacionamiento y Atraque de Aeronaves" (parking/docking).
    expect(chartTypeLabel("PDC 1", "en")).toBe(
      "Aircraft Parking / Docking Chart",
    );
    expect(chartTypeLabel("PDC 1", "de")).toBe("Luftfahrzeug-Parkkarte");
    // TRAN = "Carta de Transición a la Aproximación" (approach transition).
    expect(chartTypeLabel("TRAN 5", "en")).toBe("Approach Transition Chart");
    expect(chartTypeLabel("TRAN 5", "fr")).toBe(
      "Carte de transition d'approche",
    );
  });

  it("returns null for an unknown or non-standard designation", () => {
    // An unverified / non-designator string keeps its raw code.
    expect(chartTypeLabel("AD 2.EGPD-2-1", "en")).toBeNull();
    expect(chartTypeLabel("", "en")).toBeNull();
    expect(chartTypeLabel(null, "en")).toBeNull();
  });

  it("matches a designator glued to its number (BE-style filenames)", () => {
    expect(chartTypeLabel("EBAW_ADC01_v48.pdf", "en")).toBe("Aerodrome Chart");
    expect(chartTypeLabel("../graphics/eAIP/EBAW_ADC02_v06.pdf", "en")).toBe(
      "Aerodrome Chart",
    );
    expect(chartTypeLabel("ESNX_VAC1", "en")).toBe("Visual Approach Chart");
  });
});

describe("cleanChartName", () => {
  it("strips a leading path and a trailing .pdf", () => {
    expect(cleanChartName("../graphics/eAIP/EBAW_ADC01_v48.pdf")).toBe(
      "EBAW_ADC01_v48",
    );
    expect(cleanChartName("../graphics/eAIP/LP_AD_2_LPBJ_01-1_en.pdf")).toBe(
      "LP_AD_2_LPBJ_01-1_en",
    );
  });

  it("leaves already-clean names untouched", () => {
    expect(cleanChartName("ADC 1")).toBe("ADC 1");
    expect(cleanChartName("ESNX VAC")).toBe("ESNX VAC");
    expect(cleanChartName("AD 2-LKTB-2-1")).toBe("AD 2-LKTB-2-1");
  });

  it("keeps an internal slash in a human designation (RS sheet 1/2)", () => {
    // "1/2" = sheet 1 of 2 - the slash is NOT a path separator, so the name
    // (which has spaces) must survive intact.
    expect(cleanChartName("AD 2 LYBE 2.1-1/2 AERODROME CHART")).toBe(
      "AD 2 LYBE 2.1-1/2 AERODROME CHART",
    );
  });
});

describe("chartDisplayName", () => {
  it("shows the cleaned code plus its localized meaning", () => {
    // A raw href name (BE) becomes a readable code + spelled-out type.
    expect(chartDisplayName("../graphics/eAIP/EBAW_ADC01_v48.pdf", "en")).toBe(
      "EBAW_ADC01_v48 - Aerodrome Chart",
    );
    // A clean designator keeps its existing behaviour.
    expect(chartDisplayName("IAC 7", "de")).toBe(
      "IAC 7 - Instrumentenanflugkarte",
    );
    // No known designator: just the cleaned code.
    expect(chartDisplayName("AD 2-LKTB-2-1", "en")).toBe("AD 2-LKTB-2-1");
  });
});

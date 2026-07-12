import { describe, expect, it } from "vitest";
import { airacDateFromUrl, parseCharts } from "./charts";

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

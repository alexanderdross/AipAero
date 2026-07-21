import { describe, expect, it } from "vitest";
import { keptAd2Text, segmentAd2Text } from "~/lib/ad2-sections";

// A realistic (lightly garbled) multi-section OCR blob: a leading book header,
// then AD 2.2 / 2.3 / 2.4 / 2.20 / 2.21. AD 2.20 embeds a sub-paragraph "2.2
// Traffic circuit flights" with its own times - the trap that must NOT be
// treated as the top-level AD 2.2, and whose circuit times must be KEPT.
const BLOB =
  "LUFTFAHRTHANDBUCH DEUTSCHLAND AIP GERMANY AD 2 EDMA 1-1 16 APR 2026 " +
  "AD 2.2 Aerodrome geographical and administrative data ARP 481234N 0104321E ELEV 1516 FT " +
  "AD 2.3 Operational hours 1] AD operator MON - FRI 0500 (0400) - 2100 (2000) 2] Customs H24 " +
  "AD 2.4 Handling services and facilities Fuel AVGAS JET A1 " +
  "AD 2.20 Local aerodrome regulations 1. Approved aircraft PCN 50 2. Flight operations " +
  "2.2 Traffic circuit flights permitted MON - FRI 0600 (0500) - 1900 (1800) " +
  "AD 2.21 Noise abatement procedures Avoid overflying the town of Augsburg";

describe("segmentAd2Text", () => {
  it("splits on top-level AD 2.N markers and resolves canonical EN titles", () => {
    const sections = segmentAd2Text(BLOB, "en");
    expect(sections).not.toBeNull();
    const codes = sections!.map((s) => s.code);
    // leading preamble (null) + the five real sections
    expect(codes).toEqual([null, "2.2", "2.3", "2.4", "2.20", "2.21"]);
    const byCode = Object.fromEntries(sections!.map((s) => [s.code, s]));
    expect(byCode["2.3"]!.title).toBe("Operational hours");
    expect(byCode["2.20"]!.title).toBe("Local aerodrome regulations");
    expect(byCode["2.21"]!.title).toBe("Noise abatement procedures");
  });

  it("resolves the German titles when lang is 'de'", () => {
    const sections = segmentAd2Text(BLOB, "de")!;
    const byCode = Object.fromEntries(sections.map((s) => [s.code, s]));
    expect(byCode["2.3"]!.title).toBe("Betriebszeiten");
    expect(byCode["2.20"]!.title).toBe("Örtliche Flugbeschränkungen");
  });

  it("flags the redundant data sections (2.2, 2.3) but keeps the local ones", () => {
    const sections = segmentAd2Text(BLOB, "en")!;
    const byCode = Object.fromEntries(sections.map((s) => [s.code, s]));
    expect(byCode["2.2"]!.redundant).toBe(true);
    expect(byCode["2.3"]!.redundant).toBe(true);
    expect(byCode["2.4"]!.redundant).toBe(false);
    expect(byCode["2.20"]!.redundant).toBe(false);
    expect(byCode["2.21"]!.redundant).toBe(false);
  });

  it("keeps the AD 2.20 circuit times (not mistaken for the top-level AD 2.3 hours)", () => {
    const sections = segmentAd2Text(BLOB, "en")!;
    const local = sections.find((s) => s.code === "2.20")!;
    expect(local.redundant).toBe(false);
    expect(local.body).toContain("Traffic circuit flights permitted");
    expect(local.body).toContain("0600");
  });

  it("strips the OCR title echo from the body", () => {
    const sections = segmentAd2Text(BLOB, "en")!;
    const local = sections.find((s) => s.code === "2.20")!;
    // "Local aerodrome regulations" echo removed; body starts at the content.
    expect(local.body.startsWith("1. Approved aircraft")).toBe(true);
  });

  it("never flags the LAST section redundant (merged-boundary safety)", () => {
    // 2.3 is the last detected marker (no AD 2.4 follows), so even though it is
    // in the redundant set it must be KEPT - its body may have swallowed later
    // sections whose markers were mis-OCR'd.
    const merged =
      "AD 2.2 admin data ELEV 1516 FT " +
      "AD 2.3 Operational hours MON - FRI 0500 - 2100 and lots of trailing local text";
    const sections = segmentAd2Text(merged, "en")!;
    const byCode = Object.fromEntries(sections.map((s) => [s.code, s]));
    expect(byCode["2.2"]!.redundant).toBe(true); // has a known next boundary
    expect(byCode["2.3"]!.redundant).toBe(false); // last -> kept
  });

  it("returns null when it cannot confidently segment (fallback path)", () => {
    expect(segmentAd2Text("no section markers at all here", "en")).toBeNull();
    expect(segmentAd2Text("AD 2.3 only one marker present", "en")).toBeNull();
    expect(segmentAd2Text("", "en")).toBeNull();
    expect(segmentAd2Text(null, "en")).toBeNull();
    expect(segmentAd2Text(undefined, "de")).toBeNull();
  });
});

describe("keptAd2Text", () => {
  it("joins only the non-redundant sections, dropping 2.2/2.3", () => {
    const kept = keptAd2Text(BLOB, "en");
    expect(kept).not.toContain("481234N"); // 2.2 admin data dropped
    expect(kept).not.toContain("1] AD operator"); // 2.3 hours dropped
    expect(kept).toContain("Local aerodrome regulations");
    expect(kept).toContain("Traffic circuit flights permitted"); // kept
    expect(kept).toContain("Noise abatement procedures");
  });

  it("falls back to the whole blob when it cannot segment", () => {
    const raw = "no markers here at all";
    expect(keptAd2Text(raw, "en")).toBe(raw);
    expect(keptAd2Text(null, "en")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import {
  chartCoverage,
  cn,
  i18nPathMapping,
  isGatedCountry,
  isSelfServicePdfCountry,
} from "~/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy conditional classes", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("lets later Tailwind classes win over conflicting earlier ones", () => {
    // twMerge should collapse the conflicting padding utilities to the last.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("i18nPathMapping", () => {
  it("maps every airport type to its localized route key", () => {
    expect(i18nPathMapping).toEqual({
      vfr: "/vfr",
      ifr: "/ifr",
      heliport: "/heliports",
      mil: "/military",
      aeroport: "/aeroports",
    });
  });
});

describe("isGatedCountry", () => {
  it("is case-insensitive (the DB stores country codes uppercase)", () => {
    // Regression guard: detail-page callers pass the uppercase DB value.
    expect(isGatedCountry("ch")).toBe(true);
    expect(isGatedCountry("CH")).toBe(true);
    expect(isGatedCountry("MT")).toBe(true);
    expect(isGatedCountry("MD")).toBe(true);
  });

  it("is false for non-gated countries", () => {
    expect(isGatedCountry("de")).toBe(false);
    expect(isGatedCountry("DE")).toBe(false);
    expect(isGatedCountry("uk")).toBe(false);
  });
});

describe("isSelfServicePdfCountry", () => {
  it("flags DE (DFS BasicVFR self-service PDF), case-insensitive", () => {
    expect(isSelfServicePdfCountry("de")).toBe(true);
    expect(isSelfServicePdfCountry("DE")).toBe(true);
  });

  it("is false for countries that publish (or gate) real chart PDFs", () => {
    expect(isSelfServicePdfCountry("no")).toBe(false);
    expect(isSelfServicePdfCountry("ch")).toBe(false);
  });
});

describe("chartCoverage", () => {
  const pdf = { url: "https://x/EDDF", pdfUrl: "https://x/EDDF.pdf" };
  const noPdf = { url: "https://x/page.html", pdfUrl: null };
  const pdfViaUrl = { url: "https://x/chart.pdf", pdfUrl: null };

  it("returns gated for a login-portal country regardless of rows", () => {
    expect(chartCoverage("ch", [noPdf, pdf])).toEqual({
      bucket: "gated",
      withCharts: 0,
      total: 2,
    });
  });

  it("returns full when every field has a chart PDF (url or pdf_url)", () => {
    expect(chartCoverage("no", [pdf, pdfViaUrl])).toEqual({
      bucket: "full",
      withCharts: 2,
      total: 2,
    });
  });

  it("returns partial with the counts when only some fields have charts", () => {
    expect(chartCoverage("be", [pdf, noPdf, noPdf])).toEqual({
      bucket: "partial",
      withCharts: 1,
      total: 3,
    });
  });

  it("returns none when the authority publishes no chart PDFs (DE)", () => {
    expect(chartCoverage("de", [noPdf, noPdf])).toEqual({
      bucket: "none",
      withCharts: 0,
      total: 2,
    });
  });
});

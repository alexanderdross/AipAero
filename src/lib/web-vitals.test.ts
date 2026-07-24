import { describe, expect, it } from "vitest";
import { sanitizeVitals, vitalsToAnalyticsRow } from "~/lib/web-vitals";

describe("sanitizeVitals", () => {
  it("accepts a well-formed beacon and rounds metrics", () => {
    expect(
      sanitizeVitals({
        url: "/de/vfr/",
        metrics: { LCP: 1234.5678, CLS: 0.0123, INP: 88, FCP: 900, TTFB: 120 },
        nav: "navigate",
        conn: "4g",
      }),
    ).toEqual({
      url: "/de/vfr/",
      metrics: { LCP: 1234.568, CLS: 0.012, INP: 88, FCP: 900, TTFB: 120 },
      nav: "navigate",
      conn: "4g",
    });
  });

  it("drops unknown metric keys and out-of-range / non-finite values", () => {
    const v = sanitizeVitals({
      url: "/uk/",
      metrics: {
        LCP: 1000,
        CLS: -1, // negative
        INP: Infinity, // non-finite
        FCP: 9_999_999, // absurd
        BOGUS: 5, // not allow-listed
      },
    });
    expect(v).toEqual({ url: "/uk/", metrics: { LCP: 1000 } });
  });

  it("rejects a missing / non-path url or a payload with no valid metric", () => {
    expect(sanitizeVitals({ metrics: { LCP: 1 } })).toBeNull();
    expect(
      sanitizeVitals({ url: "https://evil/", metrics: { LCP: 1 } }),
    ).toBeNull();
    expect(sanitizeVitals({ url: "/x", metrics: {} })).toBeNull();
    expect(sanitizeVitals(null)).toBeNull();
    expect(sanitizeVitals("nope")).toBeNull();
  });

  it("caps the url length and omits absent optional fields", () => {
    const v = sanitizeVitals({
      url: "/" + "a".repeat(400),
      metrics: { TTFB: 50 },
    });
    expect(v!.url.length).toBe(256);
    expect(v!.nav).toBeUndefined();
    expect(v!.conn).toBeUndefined();
  });
});

describe("vitalsToAnalyticsRow", () => {
  it("flattens a full beacon into a persisted analytics row", () => {
    expect(
      vitalsToAnalyticsRow(
        {
          url: "/de/vfr/",
          metrics: { LCP: 1234.5, CLS: 0.012, INP: 88, FCP: 900, TTFB: 120 },
          nav: "navigate",
          conn: "4g",
        },
        1_700_000_000,
      ),
    ).toEqual({
      recordedAt: 1_700_000_000,
      url: "/de/vfr/",
      lcp: 1234.5,
      cls: 0.012,
      inp: 88,
      fcp: 900,
      ttfb: 120,
      nav: "navigate",
      conn: "4g",
    });
  });

  it("maps unreported metrics and optional fields to null (server-stamps time)", () => {
    expect(
      vitalsToAnalyticsRow({ url: "/uk/", metrics: { LCP: 1000 } }, 42),
    ).toEqual({
      recordedAt: 42,
      url: "/uk/",
      lcp: 1000,
      cls: null,
      inp: null,
      fcp: null,
      ttfb: null,
      nav: null,
      conn: null,
    });
  });
});

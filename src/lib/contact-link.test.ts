import { describe, expect, it } from "vitest";
import {
  buildContactPrefill,
  contactUrlFor,
  sanitizeIcao,
  sanitizeRef,
} from "~/lib/contact-link";

describe("contactUrlFor", () => {
  it("routes German-native locales to /de/kontakt/", () => {
    for (const locale of ["de", "at", "ch"]) {
      expect(contactUrlFor(locale, { icao: "EDNY" })).toBe(
        "/de/kontakt/?icao=EDNY",
      );
    }
  });

  it("routes non-German locales to /contact/", () => {
    for (const locale of ["uk", "fr", "de-EN", "at-EN", "ch-EN", "es", "lt"]) {
      expect(contactUrlFor(locale, { icao: "EGLL" })).toBe(
        "/contact/?icao=EGLL",
      );
    }
  });

  it("falls back to ?ref=<slug> for ICAO-less fields", () => {
    expect(contactUrlFor("uk", { icao: null, slug: "some-helipad" })).toBe(
      "/contact/?ref=some-helipad",
    );
    expect(contactUrlFor("de", { icao: undefined, slug: "helipad-x" })).toBe(
      "/de/kontakt/?ref=helipad-x",
    );
  });

  it("prefers icao over slug when both are present", () => {
    expect(contactUrlFor("uk", { icao: "EDNY", slug: "friedrichshafen" })).toBe(
      "/contact/?icao=EDNY",
    );
  });

  it("emits the bare page URL when no reference is given", () => {
    expect(contactUrlFor("uk", {})).toBe("/contact/");
    expect(contactUrlFor("de", { icao: null, slug: null })).toBe(
      "/de/kontakt/",
    );
  });
});

describe("sanitizeIcao", () => {
  it("upper-cases and accepts a plausible ICAO", () => {
    expect(sanitizeIcao("edny")).toBe("EDNY");
    expect(sanitizeIcao(" LFPG ")).toBe("LFPG");
    expect(sanitizeIcao("LY")).toBe("LY");
  });

  it("rejects junk / over-long / empty input", () => {
    expect(sanitizeIcao("EDDF; DROP TABLE")).toBeNull();
    expect(sanitizeIcao("TOOLONG")).toBeNull();
    expect(sanitizeIcao("")).toBeNull();
    expect(sanitizeIcao(undefined)).toBeNull();
    expect(sanitizeIcao("a")).toBeNull();
  });
});

describe("sanitizeRef", () => {
  it("accepts a lower-case slug", () => {
    expect(sanitizeRef("some-helipad-2")).toBe("some-helipad-2");
    expect(sanitizeRef("EDNY")).toBe("edny");
  });

  it("rejects slugs with unsafe characters", () => {
    expect(sanitizeRef("bad/slug")).toBeNull();
    expect(sanitizeRef("a b")).toBeNull();
    expect(sanitizeRef("")).toBeNull();
    expect(sanitizeRef(undefined)).toBeNull();
  });
});

describe("buildContactPrefill", () => {
  it("prefills ICAO + English subject/message from ?icao=", () => {
    expect(buildContactPrefill({ icao: "edny" }, "en")).toEqual({
      initialIcao: "EDNY",
      initialSubject: "Data correction: EDNY",
      initialMessage: expect.stringContaining("EDNY"),
    });
  });

  it("uses German copy for the German page", () => {
    expect(buildContactPrefill({ icao: "EDDF" }, "de")).toEqual({
      initialIcao: "EDDF",
      initialSubject: "Datenkorrektur: EDDF",
      initialMessage: expect.stringContaining("EDDF"),
    });
  });

  it("falls back to the ?ref slug with an empty ICAO input", () => {
    const p = buildContactPrefill({ ref: "some-helipad" }, "en");
    expect(p.initialIcao).toBe("");
    expect(p.initialSubject).toBe("Data correction: SOME-HELIPAD");
  });

  it("prefers ?icao over ?ref when both are present", () => {
    expect(buildContactPrefill({ icao: "EDNY", ref: "helipad" }, "en")).toEqual(
      {
        initialIcao: "EDNY",
        initialSubject: "Data correction: EDNY",
        initialMessage: expect.stringContaining("EDNY"),
      },
    );
  });

  it("takes the first value when a param repeats", () => {
    expect(
      buildContactPrefill({ icao: ["EDNY", "EDDF"] }, "en").initialSubject,
    ).toBe("Data correction: EDNY");
  });

  it("returns an empty object for no / invalid reference", () => {
    expect(buildContactPrefill({}, "en")).toEqual({});
    expect(buildContactPrefill({ icao: "NOT_AN_ICAO" }, "en")).toEqual({});
    expect(buildContactPrefill({ ref: "bad/slug" }, "de")).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import { sanitizeClientError } from "./client-error";

describe("sanitizeClientError", () => {
  it("accepts a well-formed error beacon", () => {
    const e = sanitizeClientError({
      kind: "error",
      message: "boom",
      url: "/de/vfr/",
      source: "https://aip.aero/_next/x.js",
      lineno: 12,
      colno: 3,
      stack: "Error: boom\n  at x",
    });
    expect(e).toEqual({
      kind: "error",
      message: "boom",
      url: "/de/vfr/",
      source: "https://aip.aero/_next/x.js",
      lineno: 12,
      colno: 3,
      stack: "Error: boom\n  at x",
    });
  });

  it("defaults an unknown kind to 'error' and keeps rejection", () => {
    expect(
      sanitizeClientError({ message: "m", url: "/", kind: "weird" })!.kind,
    ).toBe("error");
    expect(
      sanitizeClientError({
        message: "m",
        url: "/",
        kind: "unhandledrejection",
      })!.kind,
    ).toBe("unhandledrejection");
  });

  it("rejects missing message / non-same-origin url / non-object", () => {
    expect(sanitizeClientError(null)).toBeNull();
    expect(sanitizeClientError("x")).toBeNull();
    expect(sanitizeClientError({ url: "/" })).toBeNull(); // no message
    expect(sanitizeClientError({ message: "m" })).toBeNull(); // no url
    expect(
      sanitizeClientError({ message: "m", url: "https://evil.com/x" }),
    ).toBeNull(); // not a same-origin path
  });

  it("bounds oversized fields and drops bad numbers", () => {
    const e = sanitizeClientError({
      message: "x".repeat(5000),
      url: "/" + "y".repeat(5000),
      stack: "z".repeat(9000),
      lineno: -5,
      colno: 1.9,
    })!;
    expect(e.message.length).toBe(500);
    expect(e.url.length).toBe(256);
    expect(e.stack!.length).toBe(4000);
    expect(e.lineno).toBeUndefined(); // negative dropped
    expect(e.colno).toBe(1); // floored
  });
});

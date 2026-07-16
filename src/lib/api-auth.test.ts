import { describe, expect, it } from "vitest";

import { apiKeyError } from "./api-auth";

describe("apiKeyError", () => {
  it("returns 503 when no key is configured (API inert)", () => {
    expect(apiKeyError("Bearer whatever", undefined)).toEqual({
      status: 503,
      error: "API not configured",
    });
    expect(apiKeyError(null, "")).toEqual({
      status: 503,
      error: "API not configured",
    });
  });

  it("returns 401 for a missing or wrong Bearer token", () => {
    expect(apiKeyError(null, "secret")).toEqual({
      status: 401,
      error: "Unauthorized",
    });
    expect(apiKeyError("Bearer wrong", "secret")).toEqual({
      status: 401,
      error: "Unauthorized",
    });
    // No "Bearer " prefix.
    expect(apiKeyError("secret", "secret")).toEqual({
      status: 401,
      error: "Unauthorized",
    });
  });

  it("returns null (authorized) for the exact Bearer token", () => {
    expect(apiKeyError("Bearer secret", "secret")).toBeNull();
  });
});

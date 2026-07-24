import { describe, expect, it } from "vitest";

import {
  apiKeyError,
  authorizeApiRequest,
  bearerToken,
  sha256Hex,
} from "./api-auth";

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

  it("authorizes a wrong bootstrap token when a partner key matched", () => {
    // partnerMatched=true accepts a token that is not the bootstrap key...
    expect(apiKeyError("Bearer partner-token", "secret", true)).toBeNull();
    // ...but the API must still be provisioned (bootstrap key set) - an unset
    // key is 503 regardless of a partner match.
    expect(apiKeyError("Bearer partner-token", undefined, true)).toEqual({
      status: 503,
      error: "API not configured",
    });
  });
});

describe("bearerToken", () => {
  it("extracts the token or returns null", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("abc123")).toBeNull(); // no prefix
    expect(bearerToken("Bearer ")).toBeNull(); // empty token
  });
});

describe("sha256Hex", () => {
  it("hashes deterministically to 64 hex chars", async () => {
    const h = await sha256Hex("hello");
    // Known SHA-256 of "hello".
    expect(h).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(await sha256Hex("hello")).toBe(h); // stable
    expect(await sha256Hex("world")).not.toBe(h);
  });
});

describe("authorizeApiRequest", () => {
  const never = async () => false;

  it("is inert (503) when no key is configured, without a DB hit", async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return true;
    };
    expect(
      await authorizeApiRequest("Bearer anything", undefined, lookup),
    ).toEqual({ status: 503, error: "API not configured" });
    expect(called).toBe(false);
  });

  it("authorizes the bootstrap key without a DB hit", async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return true;
    };
    expect(
      await authorizeApiRequest("Bearer secret", "secret", lookup),
    ).toBeNull();
    expect(called).toBe(false);
  });

  it("authorizes a valid per-partner key (hash lookup matches)", async () => {
    const token = "partner-abc";
    const expected = await sha256Hex(token);
    const lookup = async (hash: string) => hash === expected;
    expect(
      await authorizeApiRequest(`Bearer ${token}`, "secret", lookup),
    ).toBeNull();
  });

  it("401s an unknown token that matches no partner key", async () => {
    expect(await authorizeApiRequest("Bearer nope", "secret", never)).toEqual({
      status: 401,
      error: "Unauthorized",
    });
  });

  it("fails soft to 401 when the DB lookup throws", async () => {
    const lookup = async () => {
      throw new Error("db down");
    };
    expect(
      await authorizeApiRequest("Bearer partner", "secret", lookup),
    ).toEqual({ status: 401, error: "Unauthorized" });
  });
});

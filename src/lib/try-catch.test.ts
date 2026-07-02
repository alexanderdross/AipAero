import { describe, expect, it } from "vitest";
import { tryCatch } from "~/lib/try-catch";

describe("tryCatch", () => {
  it("returns data and a null error when the promise resolves", async () => {
    const result = await tryCatch(Promise.resolve(42));
    expect(result).toEqual({ data: 42, error: null });
  });

  it("returns the error and null data when the promise rejects", async () => {
    const boom = new Error("boom");
    const result = await tryCatch(Promise.reject(boom));
    expect(result.data).toBeNull();
    expect(result.error).toBe(boom);
  });

  it("narrows to the success branch when error is null", async () => {
    const result = await tryCatch(Promise.resolve("ok"));
    // Discriminated-union narrowing: this only type-checks because a null
    // error guarantees `data` is present.
    if (result.error === null) {
      expect(result.data.toUpperCase()).toBe("OK");
    }
  });
});

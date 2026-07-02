import { describe, expect, it } from "vitest";
import { cn, i18nPathMapping } from "~/lib/utils";

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

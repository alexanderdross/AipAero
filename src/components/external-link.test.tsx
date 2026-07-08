// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExternalLink } from "./external-link";

describe("ExternalLink", () => {
  it("opens in a new tab with the given href and accessible label", () => {
    render(
      <ExternalLink href="https://example.com/aip" hrefTitle="AIP of Example">
        Example
      </ExternalLink>,
    );
    const link = screen.getByRole("link", { name: "AIP of Example" });
    expect(link).toHaveAttribute("href", "https://example.com/aip");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("title", "AIP of Example");
  });

  it("applies noopener + noreferrer as valid space-separated rel tokens", () => {
    render(
      <ExternalLink href="https://example.com" hrefTitle="Example">
        Example
      </ExternalLink>,
    );
    const rel = screen.getByRole("link").getAttribute("rel") ?? "";
    // rel is a space-delimited token list; comma-separating it (a past bug)
    // yields tokens like "noopener," that the browser does not honour, which
    // would reopen the reverse-tabnabbing hole.
    const tokens = rel.split(/\s+/).filter(Boolean);
    expect(tokens).toContain("noopener");
    expect(tokens).toContain("noreferrer");
    expect(tokens).not.toContain("noopener,");
  });
});

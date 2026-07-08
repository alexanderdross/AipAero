// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Box } from "./box";

// next/link needs the App Router context at runtime; for a unit test we only
// care that Box renders a well-formed anchor, so stub it with a plain <a>.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Box", () => {
  it("renders the title as a heading and the description", () => {
    render(<Box title="AIP Germany 🇩🇪" description="Browse the AIP" />);
    expect(
      screen.getByRole("heading", { name: "AIP Germany 🇩🇪" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse the AIP")).toBeInTheDocument();
  });

  it("renders each button as a link with href, title and rel=noopener", () => {
    render(
      <Box
        title="AIP Germany"
        description="…"
        buttons={[
          { href: "/de/en/", hrefTitle: "AIP Germany in English" },
          {
            href: "/de/",
            hrefTitle: "AIP Germany in German",
            title: "Deutsch",
          },
        ]}
      />,
    );

    const en = screen.getByRole("link", { name: "AIP Germany in English" });
    expect(en).toHaveAttribute("href", "/de/en/");
    expect(en).toHaveAttribute("rel", "noopener");
    // Falls back to hrefTitle when no explicit title is given.
    expect(en).toHaveTextContent("AIP Germany in English");

    // Explicit title becomes the visible label (and accessible name); the
    // hrefTitle is still exposed via the title attribute.
    const de = screen.getByRole("link", { name: "Deutsch" });
    expect(de).toHaveAttribute("href", "/de/");
    expect(de).toHaveAttribute("title", "AIP Germany in German");
  });
});

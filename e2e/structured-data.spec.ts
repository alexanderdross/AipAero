import { test, expect, type Page } from "@playwright/test";

// Validates the JSON-LD structured data. The site leans heavily on schema.org
// markup for SEO (BreadcrumbList, Product, WebSite, SiteNavigationElement,
// Airport, WebPage), all injected via dangerouslySetInnerHTML — a single
// malformed JSON blob silently breaks rich results with no build error. These
// tests parse every ld+json block and assert the expected @types are present.

type Parsed = {
  /** Every @type found (top level or inside an @graph), flattened. */
  types: string[];
  /** Whether every block parsed as JSON with an @context of schema.org. */
  allValid: boolean;
};

async function readJsonLd(page: Page, path: string): Promise<Parsed> {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(res?.status(), `HTTP status for ${path}`).toBe(200);

  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks.length, `no JSON-LD on ${path}`).toBeGreaterThan(0);

  const types: string[] = [];
  let allValid = true;

  const collect = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const t = obj["@type"];
      if (typeof t === "string") types.push(t);
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(collect);
    }
  };

  for (const raw of blocks) {
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch {
      allValid = false;
      continue;
    }
    // @context must reference schema.org (string, or nested per @graph item).
    const ctx = (doc as Record<string, unknown>)["@context"];
    const graph = (doc as Record<string, unknown>)["@graph"];
    const ctxOk =
      (typeof ctx === "string" && ctx.includes("schema.org")) ||
      (Array.isArray(graph) &&
        graph.every(
          (g) => typeof (g as Record<string, unknown>)["@context"] === "string",
        ));
    if (!ctxOk) allValid = false;
    collect(doc);
  }

  return { types, allValid };
}

test("root page: valid JSON-LD with Breadcrumb, Product and SiteNavigation", async ({
  page,
}) => {
  const { types, allValid } = await readJsonLd(page, "/");
  expect(allValid, "all JSON-LD blocks valid with schema.org context").toBe(
    true,
  );
  expect(types).toContain("BreadcrumbList");
  expect(types).toContain("Product");
  expect(types).toContain("SiteNavigationElement");
});

test("country page: valid JSON-LD with Breadcrumb and Product", async ({
  page,
}) => {
  const { types, allValid } = await readJsonLd(page, "/de/");
  expect(allValid).toBe(true);
  expect(types).toContain("BreadcrumbList");
  expect(types).toContain("Product");
});

test("search page: valid JSON-LD with Breadcrumb, Product and WebSite", async ({
  page,
}) => {
  const { types, allValid } = await readJsonLd(page, "/de/vfr/");
  expect(allValid).toBe(true);
  expect(types).toContain("BreadcrumbList");
  expect(types).toContain("Product");
  expect(types).toContain("WebSite");
});

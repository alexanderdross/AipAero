import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { a11yPages } from "./pages";

// Accessibility sweep with axe-core. Fails the build on serious/critical
// violations (the tier that includes the missing-landmark, colour-contrast and
// ARIA issues Lighthouse's a11y audit surfaces). We deliberately do not gate
// on minor/moderate to avoid noise; tighten later if desired.
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

for (const p of a11yPages) {
  test(`a11y: ${p.label} (${p.path})`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: "domcontentloaded" });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "best-practice"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      BLOCKING_IMPACTS.has(v.impact ?? ""),
    );

    const report = blocking
      .map(
        (v) =>
          `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
          `    ${v.helpUrl}`,
      )
      .join("\n");

    expect(
      blocking,
      `serious/critical a11y violations on ${p.path}:\n${report}`,
    ).toEqual([]);
  });
}

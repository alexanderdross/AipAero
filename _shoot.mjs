import { chromium } from "@playwright/test";
const base = process.env.BASE, SCR = process.env.SCR;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
for (const [path, name] of [["/", "1-home"], ["/de/", "2-landing"], ["/de/vfr/", "3-searchpage"]]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const box = await page.locator('input[name="search"]').boundingBox();
  await page.screenshot({ path: `${SCR}/field-${name}.png`, clip: { x: 0, y: Math.max(0, box.y - 16), width: 393, height: box.height + 32 } });
  console.log(name, "h=", Math.round(box.height));
}
await browser.close();

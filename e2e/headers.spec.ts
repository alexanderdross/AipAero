import { test, expect } from "@playwright/test";

// Security-header contract. Locks the ENFORCING Content-Security-Policy (a
// demotion back to Report-Only, or a lost directive that would break the
// chart-PDF <object> preview / the service worker / geolocation, must fail
// CI) plus the companion headers set in next.config.mjs.
test("security headers are enforced with the load-bearing directives", async ({
  request,
}) => {
  const response = await request.get("/uk/");
  expect(response.status()).toBe(200);
  const headers = response.headers();

  const csp = headers["content-security-policy"];
  expect(csp, "CSP must be sent enforcing").toBeTruthy();
  expect(
    headers["content-security-policy-report-only"],
    "CSP must not regress to Report-Only",
  ).toBeUndefined();

  // Load-bearing directives (each guards a shipped feature):
  expect(csp).toContain("frame-ancestors 'none'");
  // Chart-PDF inline preview embeds cross-origin AIP-host PDFs via <object>.
  expect(csp).toContain("object-src https:");
  // Offline service worker registration.
  expect(csp).toContain("worker-src 'self'");
  // OSM map tiles.
  expect(csp).toContain("tile.openstreetmap.org");
  // AdSense (ad slots blank out without these).
  expect(csp).toContain("pagead2.googlesyndication.com");
  expect(csp).toContain("adtrafficquality.google");

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  // The map's "locate me" button needs geolocation for our own origin;
  // an empty allowlist disables it site-wide (documented gotcha).
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
});

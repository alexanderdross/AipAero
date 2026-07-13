/**
 * EFB / pilot-tool hand-offs: deep links into external flight-planning and
 * briefing tools for a given field, shown in the contact/location box.
 *
 * VERIFIED URL PATTERNS ONLY (checked from the self-hosted runner via the
 * crawler-live-test workflow's check_urls step - the sandboxed dev
 * environment has no egress): a broken deep link is worse than none, same
 * policy as the border-crossing form links. All targets key on the ICAO
 * code, so non-ICAO fields get no hand-offs. App-scheme links (ForeFlight,
 * SkyDemon) are deliberately absent: their URL schemes are not publicly
 * documented as stable, and they fail silently when the app is missing.
 *
 * autorouter was REMOVED 13.07.2026: /airport/<ICAO> renders "page not
 * found" even for logged-in users (owner-verified in the browser) - a
 * status-code check alone had let this soft-404 through, so any re-add
 * needs a content-verified pattern (or the planned autorouter API
 * integration, see the NOTAM entry in docs/pilot-wishlist.md).
 */
export function efbLinks(
  icao: string | null | undefined,
): { name: string; href: string }[] {
  if (!icao || !/^[A-Za-z]{4}$/.test(icao)) return [];
  const code = icao.toUpperCase();
  return [
    { name: "SkyVector", href: `https://skyvector.com/airport/${code}` },
    {
      name: "Windy",
      href: `https://www.windy.com/airport/${code.toLowerCase()}`,
    },
  ];
}

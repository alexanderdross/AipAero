/**
 * Streaming fallback for `AirportGadgets`. The gadgets do several request-time
 * fetches (weather, geocoding, nearest station, facts), so they are wrapped in a
 * <Suspense> boundary on the detail pages: the page shell (title + chart link)
 * flushes first, the gadgets stream in when ready. This placeholder reserves a
 * comparable height so the About box below does not jump when they arrive (CLS).
 */
export function AirportGadgetsFallback() {
  const box =
    "rounded-xl border border-drossgray-dark/15 bg-white p-4 shadow-sm animate-pulse";
  return (
    <div
      className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8"
      aria-hidden="true"
    >
      {/* Mirror the real gadget stack so the footer barely moves when the
          streamed content replaces this: the contact + aerodrome-data grid,
          then the weather box (matches AirportWeatherWind's own h-48 loading
          skeleton), then the "nearby airfields" list. The optional PDF-chart
          box is omitted on purpose - most fields (e.g. the DE DFS HTML links)
          have none, so reserving for it would over-shoot more often than not. */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`${box} h-64`} />
          <div className={`${box} h-64`} />
        </div>
        <div className={`${box} h-48`} />
        <div className={`${box} h-40`} />
      </div>
    </div>
  );
}

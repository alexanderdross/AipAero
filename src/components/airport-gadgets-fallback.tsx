/**
 * Streaming fallback for `AirportGadgets`. The gadgets do several request-time
 * fetches (weather, geocoding, nearest station, facts), so they are wrapped in a
 * <Suspense> boundary on the detail pages: the page shell (title + chart link)
 * flushes first, the gadgets stream in when ready. This placeholder reserves a
 * comparable height so the About box below does not jump when they arrive (CLS).
 */
export function AirportGadgetsFallback() {
  const box = "border border-[#ccc] bg-white p-4 animate-pulse";
  return (
    <div
      className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`${box} h-44`} />
          <div className={`${box} h-44`} />
        </div>
        <div className={`${box} h-72`} />
      </div>
    </div>
  );
}

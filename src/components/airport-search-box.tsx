"use client";

import { ArrowRightIcon, SearchXIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { SearchField } from "~/components/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import {
  type SearchState,
  searchAirportsCountry,
  searchAirportsGlobal,
} from "~/server/actions";
import type { Airport } from "~/server/db/schema";

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

// Map the airport type to its (unlocalized) route segment. The search routes
// (/vfr, /ifr, /heliports, /military, /aeroports) are NOT localized in
// routing.ts (they map to themselves), so a detail URL is just
// `<localeBase>/<segment>/?<slug>` - no per-locale slug lookup needed.
const TYPE_PATH: Record<Airport["type"], string> = {
  vfr: "vfr",
  ifr: "ifr",
  heliport: "heliports",
  mil: "military",
  aeroport: "aeroports",
};

// Short label shown on each result so the same field appearing under several
// categories (e.g. Friedrichshafen as VFR, IFR and Heliport) is distinguishable.
const TYPE_LABEL: Record<Airport["type"], string> = {
  vfr: "VFR",
  ifr: "IFR",
  heliport: "Heliport",
  mil: "Military",
  aeroport: "Aéroport",
};

const initialState: SearchState = { airports: [], query: "" };

// Loading placeholder: a few result-row-shaped skeletons while a query is in
// flight, so the panel shows immediate feedback (not a bare "..." that reads
// like an error) and the layout matches the incoming rows.
function ResultsSkeleton() {
  return (
    <div className="space-y-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * The site's discovery search: an as-you-type box whose results ALWAYS link to
 * the internal airport DETAIL page (never straight out to the raw AIP), so the
 * visitor stays on-site and gets the weather / facts / chart-PDF gadgets. Two
 * scopes share this one component:
 *
 *  - `scope="global"` (default) - the homepage + 404 pages: searches every
 *    country and type (`searchAirportsGlobal`). Detail links resolve to each
 *    airport's own NATIVE-locale page. Also the target of the WebSite
 *    SearchAction (Sitelinks Search Box): the valueless `?<term>` query key is
 *    read on mount and executed.
 *  - `scope="country"` - the country landing page: searches ALL of that one
 *    country's types (`searchAirportsCountry`), so the visitor never has to
 *    pre-pick a category. Detail links stay in the current locale via
 *    `detailBase` (e.g. "/de" or "/de/en").
 */
export function AirportSearchBox({
  placeholder,
  noResultsLabel,
  scope = "global",
  country,
  detailBase,
  readTermFromUrl = scope === "global",
}: {
  placeholder: string;
  /** Localized "no airports found" note; omit to render nothing on empty. */
  noResultsLabel?: string;
  scope?: "global" | "country";
  /** Two-letter country code - required (and hidden-posted) when scope="country". */
  country?: string;
  /** Locale-prefixed base for detail hrefs (e.g. "/de", "/de/en") - country scope. */
  detailBase?: string;
  /** Read the valueless `?<term>` URL key on mount (Sitelinks Search Box). */
  readTermFromUrl?: boolean;
}) {
  const action =
    scope === "country" ? searchAirportsCountry : searchAirportsGlobal;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const formRef = useRef<HTMLFormElement>(null);
  const hasTypedRef = useRef(false);

  // Cross-country result link: the airport's detail page. In country scope the
  // locale-prefixed `detailBase` keeps the visitor in their locale; in global
  // scope the target is the airport's own native-locale page (the lowercased
  // country code is the native prefix, e.g. DE -> /de/vfr/?EDDF).
  function detailHref(a: Airport): string {
    const segment = TYPE_PATH[a.type];
    if (scope === "country" && detailBase) {
      return `${detailBase}/${segment}/?${a.slug}`;
    }
    return `/${a.country.toLowerCase()}/${segment}/?${a.slug}`;
  }

  // Execute a search handed over via the Sitelinks-Search-Box URL (see the
  // WebSite SearchAction JSON-LD on the root page). The site's SEO scheme uses
  // a VALUELESS query key - https://aip.aero/?EDNY, exactly like the ?ICAO
  // airport-detail URLs - so pick the first key without a value; params WITH
  // values (utm_*, fbclid, ...) are skipped by construction. Read
  // window.location on mount instead of useSearchParams so a statically
  // prerendered host page needs no Suspense/CSR bailout.
  useEffect(() => {
    if (!readTermFromUrl) return;
    const params = new URLSearchParams(window.location.search);
    const term = Array.from(params.entries()).find(([, v]) => v === "")?.[0];
    if (term) {
      hasTypedRef.current = true;
      setSearch(term.slice(0, 50));
    }
  }, [readTermFromUrl]);

  // Submit after the user pauses typing (one query per settled burst).
  useEffect(() => {
    if (!hasTypedRef.current || debounced.length === 0) return;
    formRef.current?.requestSubmit();
  }, [debounced]);

  const results = state.airports;
  // "A search completed and matched nothing" - distinct from "nothing searched
  // yet". `state.query` is only set once an action RETURNS, so this never
  // flashes before the query runs; a newer in-flight query flips `pending`,
  // which takes precedence (the skeleton shows instead).
  const showNoResults =
    !pending &&
    results.length === 0 &&
    state.query.length > 0 &&
    search.trim().length > 0 &&
    !!noResultsLabel;
  const showPanel = pending || results.length > 0 || showNoResults;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-2 sm:px-6 lg:px-8">
      <form action={formAction} ref={formRef}>
        <label htmlFor="airport-search" className="sr-only">
          {placeholder}
        </label>
        {scope === "country" && country && (
          <input type="hidden" name="country" value={country} />
        )}
        <SearchField
          id="airport-search"
          name="search"
          placeholder={placeholder}
          title={placeholder}
          value={search}
          onChange={(e) => {
            hasTypedRef.current = true;
            setSearch(e.currentTarget.value);
          }}
          // ARIA combobox with a listbox popup (WAI-ARIA APG). The results are
          // real <a> links the user reaches by Tab - no arrow-key/roving-focus
          // model (deliberate) - so this stays a static-semantics enhancement
          // with no extra JS: `aria-expanded` reflects whether the options list
          // is shown, `aria-busy` the in-flight query.
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={
            results.length > 0 ? "airport-search-listbox" : undefined
          }
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={pending || undefined}
          overlay={
            // Results overlay the content below instead of pushing it down: the
            // rows land after the 250ms debounce + server action, often outside
            // the 500ms post-input window CLS excuses, so an in-flow list scores
            // as layout shift. The panel shows a skeleton while loading, the
            // results when they land, or a localized "no airports found" note.
            showPanel && (
              <div className="absolute inset-x-0 top-full z-10 mt-2 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                {results.length > 0 ? (
                  <>
                    {/* The combobox popup: a listbox of option links (reached
                        by Tab). aria-label names the popup; each option carries
                        the required role="option"/aria-selected. Only options
                        live inside the listbox - the skeleton is a sibling. */}
                    <div
                      id="airport-search-listbox"
                      role="listbox"
                      aria-label={placeholder}
                      className="space-y-1"
                    >
                      {results.map((airport, i) => (
                        <a
                          key={i}
                          role="option"
                          aria-selected={false}
                          href={detailHref(airport)}
                          title={`${airport.title} - ${TYPE_LABEL[airport.type]}`}
                          className="bg-drossblue hover:bg-drossblue-light flex items-center justify-center gap-x-2 rounded-lg px-3 py-2.5 text-white transition-colors"
                        >
                          <span>{airport.title}</span>
                          <span className="text-drossblue rounded bg-white px-1.5 py-0.5 text-xs font-semibold tracking-wide">
                            {TYPE_LABEL[airport.type]}
                          </span>
                          {/* The country code is redundant in country scope
                              (all results share it), so only in global scope. */}
                          {scope === "global" && (
                            <span className="text-xs uppercase opacity-80">
                              {airport.country}
                            </span>
                          )}
                          <ArrowRightIcon
                            className="h-4 w-4 flex-shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                    </div>
                    {/* A newer query is in flight while old results still show. */}
                    {pending && (
                      <Skeleton className="mt-1 h-11 w-full rounded-lg" />
                    )}
                  </>
                ) : pending ? (
                  <ResultsSkeleton />
                ) : (
                  // role="status" (implicit aria-live polite) announces the
                  // empty result without wrapping the listbox in a live region.
                  <p
                    role="status"
                    className="text-drossgray-dark flex items-center justify-center gap-x-2 px-3 py-3 text-sm"
                  >
                    <SearchXIcon
                      className="size-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{noResultsLabel}</span>
                  </p>
                )}
              </div>
            )
          }
        />
      </form>
    </div>
  );
}

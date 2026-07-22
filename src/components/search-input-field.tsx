"use client";

import { ArrowRightIcon, SearchXIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { SearchField } from "~/components/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import { type SearchState, searchAirports } from "~/server/actions";
import type { Airport } from "~/server/db/schema";
import { useRouter } from "next/navigation";

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const initialState: SearchState = { airports: [], query: "" };

export function SearchInputField({
  value,
  title,
  type,
  country,
  noResultsLabel,
}: {
  value?: string;
  title: string;
  type: Airport["type"];
  country: string;
  /** Localized "no airports found" note shown when a search matched nothing. */
  noResultsLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    searchAirports,
    initialState,
  );
  const [search, setSearch] = useState(value ?? "");
  const debouncedSearch = useDebounce(search, 250);
  const formRef = useRef<HTMLFormElement>(null);
  const hasTypedRef = useRef(false);
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    hasTypedRef.current = true;
    setSearch(e.currentTarget.value);
  }

  // Submit the query only after the user pauses typing, so we fire one server
  // action per settled keystroke burst instead of one per character. The
  // `useDebounce` helper above was defined but previously unused - this wires
  // it up. `hasTypedRef` skips the initial prefilled value (airport-detail
  // pages seed the box with the ICAO) so we don't auto-submit and redirect on
  // mount; the empty-string guard avoids a no-op submit on clear.
  useEffect(() => {
    if (!hasTypedRef.current || debouncedSearch.length === 0) return;
    formRef.current?.requestSubmit();
  }, [debouncedSearch]);

  useEffect(() => {
    // If single result, redirect to the airport page
    if (state.airports.length === 1) {
      router.push(`./?${state.airports.at(0)?.slug}`);
    } else if (state.airports.length > 1) {
      router.push("./");
    }
  }, [state, router]);

  const results = state.airports;
  // "A search completed and matched nothing" - distinct from "nothing searched
  // yet" (`state.query` is only set once the action returns, so it never
  // flashes before the query runs). A single result self-redirects to its
  // detail page (no panel); >1 lists.
  const showNoResults =
    !pending &&
    results.length === 0 &&
    state.query.length > 0 &&
    search.trim().length > 0 &&
    !!noResultsLabel;
  const showPanel = pending || results.length > 1 || showNoResults;

  return (
    <form action={formAction} ref={formRef}>
      <label htmlFor="search" className="sr-only">
        {title}
      </label>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="country" value={country} />
      <SearchField
        id="search"
        name="search"
        placeholder={title}
        title={title}
        value={search ?? value}
        onChange={(e) => onChange(e)}
        // Autofocus ONLY on the base search view (no prefilled value). On an
        // airport-detail page the box is seeded with the field's ICAO, where
        // stealing focus (and popping the mobile keyboard) is disruptive - the
        // visitor came to read the chart/gadgets, not to search.
        autoFocus={!value}
        // ARIA combobox with a listbox popup (WAI-ARIA APG). The result rows are
        // real <a> links reached by Tab - no arrow-key model (deliberate). The
        // popup only shows for >1 result (a single result self-redirects), so
        // aria-expanded tracks that; aria-busy reflects the in-flight query.
        role="combobox"
        aria-expanded={results.length > 1}
        aria-controls={results.length > 1 ? "search-listbox" : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-busy={pending || undefined}
        overlay={
          // Absolute overlay (no CLS - it never pushes the page content below).
          // Each result links to the airport's own DETAIL page (`./?<slug>`),
          // NOT straight out to the raw AIP: that keeps the visitor on-site and
          // matches the homepage / country-landing search. A skeleton shows
          // while loading, a localized note when nothing matched.
          showPanel && (
            <div className="absolute inset-x-0 top-full z-10 mt-2 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
              {results.length > 1 ? (
                <>
                  {/* Listbox of option links (reached by Tab). Only options
                      live inside - the skeleton is a sibling. */}
                  <div
                    id="search-listbox"
                    role="listbox"
                    aria-label={title}
                    className="space-y-1"
                  >
                    {results.map((airport, index) => (
                      <a
                        key={index}
                        role="option"
                        aria-selected={false}
                        href={`./?${airport.slug}`}
                        title={airport.title}
                        className="bg-drossblue hover:bg-drossblue-light flex items-center justify-center gap-x-2 rounded-lg px-3 py-2.5 text-white transition-colors"
                      >
                        <span>{airport.title}</span>
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
                <div className="space-y-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                // role="status" (implicit aria-live polite) announces the empty
                // result without wrapping the listbox in a live region.
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
  );
}

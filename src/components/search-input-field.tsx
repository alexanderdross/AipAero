"use client";

import { ArrowRightIcon, SearchXIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
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
    <>
      <form action={formAction} ref={formRef}>
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <Input
          id="search"
          name="search"
          className="bg-white text-center"
          type="text"
          placeholder={title}
          title={title}
          value={search ?? value}
          onChange={(e) => onChange(e)}
          autoComplete="off"
          // Autofocus ONLY on the base search view (no prefilled value). On an
          // airport-detail page the box is seeded with the field's ICAO, where
          // stealing focus (and popping the mobile keyboard) is disruptive - the
          // visitor came to read the chart/gadgets, not to search.
          autoFocus={!value}
          // ARIA combobox with a listbox popup (WAI-ARIA APG). The result rows
          // are real <a> links reached by Tab - no arrow-key model (deliberate).
          // The popup only shows for >1 result (a single result self-redirects),
          // so aria-expanded tracks that; aria-busy reflects the in-flight query.
          role="combobox"
          aria-expanded={results.length > 1}
          aria-controls={results.length > 1 ? "search-listbox" : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={pending || undefined}
        />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="country" value={country} />
      </form>
      {/* The results deliberately overlay the page content below (no CLS);
          the opaque panel keeps that content from showing through the gaps
          between the result rows. A SINGLE result never renders here: the
          effect above navigates to its detail URL, whose page server-renders
          the same chart link in this exact spot - the panel would just stack
          on top of it. Each result links to the airport's own DETAIL page
          (`./?<slug>`), NOT straight out to the raw AIP: that keeps the visitor
          on-site (weather / facts / chart-PDF gadgets) and matches the global
          and country landing searches - the external AIP link lives on the
          detail page itself. While a query is in flight the panel shows a
          skeleton, and a search that matched nothing shows a localized note. */}
      <div className="absolute left-1/2 z-10 mt-3 w-full max-w-7xl -translate-x-1/2 px-4 text-center text-white sm:px-6 lg:px-8">
        {showPanel && (
          <div className="rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
            {results.length > 1 ? (
              <>
                {/* The combobox popup: a listbox of option links (reached by
                    Tab). Only options live inside - the loading skeleton and
                    the trailing status are siblings. */}
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
                      className="bg-drossblue hover:bg-drossblue-light focus-visible:ring-drossblue flex w-full items-center justify-center gap-x-2 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <span>{airport.title}</span>
                      <ArrowRightIcon
                        className="h-5 w-5 flex-shrink-0"
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
              // role="status" (implicit aria-live polite) so the empty result is
              // announced without wrapping the listbox in a live region.
              <p
                role="status"
                className="text-drossgray-dark flex items-center justify-center gap-x-2 px-4 py-3 text-sm"
              >
                <SearchXIcon
                  className="size-4 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{noResultsLabel}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

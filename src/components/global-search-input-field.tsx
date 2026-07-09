"use client";

import { ArrowRightIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { searchAirportsGlobal } from "~/server/actions";
import type { Airport } from "~/server/db/schema";

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

// Map the airport type to its (unlocalized) route segment.
const TYPE_PATH: Record<Airport["type"], string> = {
  vfr: "vfr",
  ifr: "ifr",
  heliport: "heliports",
  mil: "military",
  aeroport: "aeroports",
};

// Cross-country result link: the airport's native-locale detail page, e.g.
// { country: "DE", type: "vfr", slug: "EDDF" } -> "/de/vfr/?EDDF". Country codes
// are stored uppercase; the native locale prefix is just the lowercased code.
function detailHref(a: Airport): string {
  return `/${a.country.toLowerCase()}/${TYPE_PATH[a.type]}/?${a.slug}`;
}

const initialState: { airports: Airport[] } = { airports: [] };

export function GlobalSearchInputField({
  placeholder,
}: {
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(
    searchAirportsGlobal,
    initialState,
  );
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const formRef = useRef<HTMLFormElement>(null);
  const hasTypedRef = useRef(false);

  // Execute a search handed over via the Sitelinks-Search-Box URL (see the
  // WebSite SearchAction JSON-LD on the root page). The site's SEO scheme
  // uses a VALUELESS query key - https://aip.aero/?EDNY, exactly like the
  // ?ICAO airport-detail URLs - so pick the first key without a value;
  // params WITH values (utm_*, fbclid, ...) are skipped by construction.
  // Read window.location on mount instead of useSearchParams so the
  // statically prerendered root page needs no Suspense/CSR bailout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const term = Array.from(params.entries()).find(([, v]) => v === "")?.[0];
    if (term) {
      hasTypedRef.current = true;
      setSearch(term.slice(0, 50));
    }
  }, []);

  // Submit after the user pauses typing (one query per settled burst).
  useEffect(() => {
    if (!hasTypedRef.current || debounced.length === 0) return;
    formRef.current?.requestSubmit();
  }, [debounced]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <form action={formAction} ref={formRef}>
        <label htmlFor="global-search" className="sr-only">
          {placeholder}
        </label>
        <Input
          id="global-search"
          name="search"
          className="bg-white text-center"
          type="text"
          placeholder={placeholder}
          title={placeholder}
          value={search}
          onChange={(e) => {
            hasTypedRef.current = true;
            setSearch(e.currentTarget.value);
          }}
          autoComplete="off"
        />
      </form>
      {state.airports.length > 0 && (
        <ol className="mt-2">
          {state.airports.map((airport, i) => (
            <li key={i}>
              <a
                href={detailHref(airport)}
                title={airport.title}
                className="bg-drossblue hover:bg-drossblue-light mt-1 flex items-center justify-center gap-x-2 py-2 text-white"
              >
                <span>{airport.title}</span>
                <span className="text-xs uppercase opacity-80">
                  {airport.country}
                </span>
                <ArrowRightIcon
                  className="h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ol>
      )}
      {pending && state.airports.length !== 0 && (
        <div className="bg-drossblue mt-1 py-2 text-center text-white">...</div>
      )}
    </div>
  );
}

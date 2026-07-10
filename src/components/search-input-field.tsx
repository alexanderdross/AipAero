"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { searchAirports } from "~/server/actions";
import { ExternalLink } from "./external-link";
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

const initialState = {
  airports: [],
};

export function SearchInputField({
  value,
  title,
  type,
  country,
}: {
  value?: string;
  title: string;
  type: Airport["type"];
  country: string;
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
  }, [state]);

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
          autoFocus
        />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="country" value={country} />
      </form>
      {/* The results deliberately overlay the page content below (no CLS);
          the opaque panel keeps that content from showing through the gaps
          between the result rows. */}
      <div className="absolute left-1/2 z-10 mt-3 w-full max-w-7xl -translate-x-1/2 px-4 text-center text-white sm:px-6 lg:px-8">
        {state.airports.length > 0 && (
          <div className="rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
            <ol className="space-y-1">
              {state.airports.map((airport, index) => (
                <li key={index}>
                  <ExternalLink
                    href={`${airport.url}`}
                    className="bg-drossblue hover:bg-drossblue-light focus-visible:ring-drossblue flex w-full items-center justify-center gap-x-2 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    hrefTitle={`${airport.title}`} //hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
                  >
                    <span className="text-drossblue rounded bg-white px-1.5 py-0.5 text-xs font-semibold tracking-wide">
                      AIP
                    </span>
                    <span>{airport.title}</span>
                    <ExternalLinkIcon
                      className="h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                  </ExternalLink>
                </li>
              ))}
            </ol>
            {pending && (
              <div className="bg-drossblue mt-1 rounded-lg py-2">...</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

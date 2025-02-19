'use client'

import { ExternalLinkIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
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
    }, delay)
    return () => {
      clearTimeout(handler);
    }
  }, [value, delay])
  return debouncedValue;
}

const initialState = {
  airports: [],
}

export function SearchInputField({ value, title, type, country }: { value?: string; title: string, type: Airport['type'], country: string }) {
  const [state, formAction, pending] = useActionState(searchAirports, initialState);
  const [search, setSearch] = useState(value ?? '');
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.currentTarget.value);
    e.currentTarget.form?.requestSubmit();
  }

  useEffect(() => {
    // If single result, redirect to the airport page
    if (state.airports.length === 1) {
      router.push(`./?${state.airports.at(0)?.icao}`);
    } else if (state.airports.length > 1) {
      router.push('./');
    }
  }, [state]);

  return (
    <>
      <form action={formAction}>
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <Input
          name="search"
          className="text-center bg-white"
          type="text"
          placeholder={title}
          title={title}
          value={search ?? value}
          onChange={(e) => onChange(e)}
          autoFocus
        />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="country" value={country} />
      </form>
      <div className="max-w-7xl px-4 sm:px-6 lg:px-8 text-center mt-3 w-full text-white absolute left-1/2 transform -translate-x-1/2">
        <ol>
          {state.airports.map((airport, index) => {
            // Erstellen des Regex für die Übereinstimmung
            const regex = new RegExp(`()`, 'gi');
            const parts = airport.title.split(regex);

            return (<li key={index}>
              <ExternalLink
                href={`${airport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${airport.title}`}//hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
              >
                <span>
                  {parts.map((part, i) =>
                    regex.test(part) ? (
                      <span key={i} className="underline">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </span>
                <ExternalLinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              </ExternalLink>
            </li>)
          })}
        </ol>
        {pending && state.airports.length !== 0 && (
          <div className="bg-drossblue py-2">...</div>
        )}
      </div>
    </>
  )
}
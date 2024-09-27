'use client';
/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */

import { LinkIcon } from "@heroicons/react/solid";
import { useEffect, useState } from "react";
import { ExternalLink } from "./external-link";
import { api } from "~/trpc/react";
import { useSearchParams } from "next/navigation";

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

export default function Search({
  countryCode,
  searchPlaceholder,
  searchResultHrefTitle,
  searchResultEmpty,
  type
}: {
  countryCode: string,
  searchPlaceholder: string,
  searchResultHrefTitle: string,
  searchResultEmpty: string,
  type: "ifr" | "vfr" | "heliport"
}) {
  const searchParams = useSearchParams();
  // Get keys of searchParams
  const keys = Array.from(searchParams.keys());
  const [query, setQuery] = useState(keys.at(0) ?? "");
  const debouncedQuery = useDebounce(query, 500);
  const [data] = api.airport.search.useSuspenseQuery({
    type: type,
    country: countryCode,
    query: debouncedQuery
  });

  function onSearch(e: React.FormEvent<HTMLInputElement>) {
    e.preventDefault();
    setQuery(e.currentTarget.value);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        type="text"
        name="search"
        id="search"
        className="shadow-sm focus:ring-drossblue focus:border-drossblue block w-full sm:text-sm border-gray-300 rounded-md text-center"
        placeholder={searchPlaceholder}
        title={searchPlaceholder}
        value={query}
        onChange={onSearch}
        autoFocus
      />
      <div className="max-w-7xl pr-8 sm:pr-12 lg:pr-16 text-center mt-4 w-full text-white absolute">
        <ol>
          {data.map((airport) => (
            <li key={airport.icao} itemScope itemType="https://schema.org/Airport">
              <ExternalLink
                key={airport.icao}
                href={`${airport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${searchResultHrefTitle} ${airport.title} ${airport.icao}`}
              >
                <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span itemProp="name">{airport.title} {airport.icao}</span>
              </ExternalLink>
              <meta itemProp="description" content={`${searchResultHrefTitle} ${airport.title} ${airport.icao}`} />
              <meta itemProp="icaoCode" content={airport.icao} />
            </li>
          ))}
        </ol>
        {data.length === 0 && query.length !== 0 && (
          <div className="bg-drossblue py-2">{searchResultEmpty}</div>
        )}
      </div>
    </div>
  )
}
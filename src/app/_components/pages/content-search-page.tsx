'use client';
/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */

import type { SearchPageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import Metadata from "~/app/_components/metadata";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { ExternalLink } from "~/app/_components/external-link";
import { LinkIcon } from "@heroicons/react/solid";
import { SchemaProduct } from "../schemas/schema-product";
import { SchemaAirport } from "../schemas/schema-airport";
import { SchemaWebsite } from "../schemas/schema-website";
import { LoadingSpinner } from "../loading-spinner";

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

export function ContentSearchPage({ translation, type }: {
  translation: SearchPageTranslation; type: 'vfr' | 'ifr' | 'heliport';
}) {
  const searchParams = useSearchParams();
  // Get keys of searchParams
  const keys = Array.from(searchParams.keys());
  const airportParam = keys.at(0);
  // Prefetch query at first render
  airportParam && airportParam.length > 0 && api.airport.search.usePrefetchQuery({
    type: type,
    country: translation.Tld,
    query: airportParam
  });
  const [query, setQuery] = useState(airportParam ?? "");
  const debouncedQuery = useDebounce(query, 500);
  const { isLoading, data } = api.airport.search.useQuery({
    type: type,
    country: translation.Tld,
    query: debouncedQuery
  });

  function onSearch(e: React.FormEvent<HTMLInputElement>) {
    e.preventDefault();
    setQuery(e.currentTarget.value);
  }

  const isAirportResultAndLoading = isLoading && airportParam?.length !== 0 && airportParam === query;
  const isAirportResult = airportParam && data?.length === 1 && data[0]?.title;

  const airportName = isAirportResult ? data[0]!.title : "";
  const title = isAirportResult
    ? `${translation.airportPageTitle} ${data[0]!.title}` : translation.title;
  const description = isAirportResult
    ? translation.airportPageDescription.replace('XXXX', data[0]!.title) : translation.description;

  return (
    <>
      <Metadata
        title={title}
        description={description}
        url={translation.href}
        alternates={translation.alternate && translation.alternateIetfLang
          ? [{ href: translation.href, hrefLang: translation.ietfLang },
          { href: translation.alternate, hrefLang: translation.alternateIetfLang }]
          : [{ href: translation.href, hrefLang: translation.ietfLang }]}
      />
      <SchemaProduct
        name={title}
        alternateName={translation.menuTitle}
        description={description}
      />
      {isAirportResult && <SchemaAirport
        name={airportName}
        alternateName={title}
        description={description}
      />}
      <SchemaWebsite />
      {isAirportResultAndLoading ? <div className="flex justify-center py-20 sm:py-14">
        <LoadingSpinner />
      </div> :
        <Header
          title={title}
          description={description}
        />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <input
          type="text"
          name="search"
          id="search"
          className="shadow-sm focus:ring-drossblue focus:border-drossblue block w-full sm:text-sm border-gray-300 rounded-md text-center"
          placeholder={translation.searchPlaceholder}
          title={translation.searchPlaceholder}
          value={query}
          onChange={onSearch}
          autoFocus
        />
        <div className="max-w-7xl pr-8 sm:pr-12 lg:pr-16 text-center mt-3 w-full text-white absolute">
          <ol>
            {data?.map((airport) => (
              <li key={airport.icao}>
                <ExternalLink
                  key={airport.icao}
                  href={`${airport.url}`}
                  className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                  hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
                >
                  <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                  <span>{airport.title}</span>
                </ExternalLink>
              </li>
            ))}
          </ol>
          {!isLoading && data?.length === 0 && query.length !== 0 && (
            <div className="bg-drossblue py-2">{translation.searchResultEmpty}</div>
          )}
          {isLoading && (
            <div className="bg-drossblue py-2">...</div>
          )}
        </div>
      </div>
    </>
  );
}
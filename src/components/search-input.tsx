'use client';
import { skipToken } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type SearchPageTranslation } from "~/lib/i18n";
import { api } from "~/trpc/react";
import { ExternalLink } from "./external-link";
import { usePathname, useRouter } from "next/navigation";
import { Airport } from "~/server/db/schema";
import { ExternalLinkIcon } from "lucide-react";

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

export function SearchInput({
  translation,
  type,
  initialAirport
}: {
  translation: SearchPageTranslation,
  type: 'vfr' | 'ifr' | 'heliport';
  initialAirport?: Airport;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialAirport?.title ?? "");

  const debouncedQuery = useDebounce(query, 500);
  const inputChangedFromInitial = initialAirport?.title !== debouncedQuery;
  const { isLoading, data } = api.airport.search.useQuery(!initialAirport || inputChangedFromInitial ? {
    type: type,
    country: translation.Tld,
    query: debouncedQuery
  } : skipToken);

  function onSearch(e: React.FormEvent<HTMLInputElement>) {
    e.preventDefault();
    setQuery(e.currentTarget.value);
  }

  useEffect(() => {
    if (data && data?.length === 1) {
      router.push(`${pathname}?${data.at(0)!.slug}`);
    } else if (data && data?.length > 1) {
      router.push(pathname);
    }
  }, [data, router, pathname]);

  return (
    <>
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        type="text"
        name="search"
        id="search"
        className="shadow-sm focus:ring-drossblue focus:border-drossblue block w-full sm:text-sm border-drossblue-light rounded-md text-center"
        placeholder={translation.searchPlaceholder}
        title={translation.searchPlaceholder}
        value={query}
        onChange={onSearch}
        autoFocus
      />
      <div className="max-w-7xl px-4 sm:px-6 lg:px-8 text-center mt-3 w-full text-white absolute left-1/2 transform -translate-x-1/2">
        <ol>
          {initialAirport && (
            <li>
              <ExternalLink
                href={`${initialAirport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${translation.searchResultHrefTitle} ${initialAirport.title}`}
              >
                <span>{initialAirport.title}</span>
                <ExternalLinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              </ExternalLink>
            </li>
          )}
          {!initialAirport && data?.map((airport, index) => {
            // Erstellen des Regex für die Übereinstimmung
            const regex = new RegExp(`(${debouncedQuery})`, 'gi');
            const parts = airport.title.split(regex);

            return (<li key={index}>
              <ExternalLink
                href={`${airport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
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
        {!isLoading && data?.length === 0 && query.length !== 0 && (
          <div className="bg-drossblue py-2">{translation.searchResultEmpty}</div>
        )}
        {isLoading && query.length !== 0 && (
          <div className="bg-drossblue py-2">...</div>
        )}
      </div>
    </>
  );
}
'use client';

import { LinkIcon } from "@heroicons/react/solid";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)
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

export default function Search({ placeholder, type }: { placeholder: string; type: "vfr" | "ifr" | "heliport" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const localeKey = pathname.includes('/en/') ? 'english' : 'native';

  let t;
  if (type === "vfr") {
    t = useTranslations(`VfrPage.${localeKey}`);
  } else if (type === "ifr") {
    t = useTranslations(`IfrPage.${localeKey}`);
  } else {
    t = useTranslations(`HeliportPage.${localeKey}`);
  }

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const [data] = api.airport.search.useSuspenseQuery({
    type: type,
    country: locale,
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
        placeholder={placeholder}
        title={placeholder}
        value={query}
        onChange={onSearch}
        autoFocus
      />
      <div className="text-center mt-4 w-full text-white">
        {data.map((airport) => (
          <a
            key={airport.icao}
            href={`${airport.url}`}
            target="_blank"
            rel="noopener, noreferrer, noindex, nofollow"
            className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
            title={`${t('searchResultHrefTitle')} ${airport.title} ${airport.icao}`}
          >
            <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
            {airport.title} {airport.icao}
          </a>
        ))}
        {data.length === 0 && query.length !== 0 && (
          <div className="bg-drossblue py-2">{t('notFound')}</div>
        )}
      </div>
    </div>
  )
}
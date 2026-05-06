"use client";

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
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.currentTarget.value);
    e.currentTarget.form?.requestSubmit();
  }

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
      <form action={formAction}>
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <Input
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
      <div className="absolute left-1/2 mt-3 w-full max-w-7xl -translate-x-1/2 transform px-4 text-center text-white sm:px-6 lg:px-8">
        <ol>
          {state.airports.map((airport, index) => {
            // Erstellen des Regex für die Übereinstimmung
            const regex = new RegExp(`()`, "gi");
            const parts = airport.title.split(regex);

            return (
              <li key={index}>
                <ExternalLink
                  href={`${airport.url}`}
                  className="flex content-center justify-center gap-x-2 bg-drossblue py-2 hover:bg-drossblue-light"
                  hrefTitle={`${airport.title}`} //hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
                >
                  <span>
                    {parts.map((part, i) =>
                      regex.test(part) ? (
                        <span key={i} className="underline">
                          {part}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      ),
                    )}
                  </span>
                  <ExternalLinkIcon
                    className="h-5 w-5 flex-shrink-0"
                    aria-hidden="true"
                  />
                </ExternalLink>
              </li>
            );
          })}
        </ol>
        {pending && state.airports.length !== 0 && (
          <div className="bg-drossblue py-2">...</div>
        )}
      </div>
    </>
  );
}

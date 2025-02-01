'use client'

import { useEffect, useState } from "react";

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
 
export function SearchInputField({ value, title }: { value?: string; title: string }) { 
  return (
    <div>
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        type="text"
        name="search"
        id="search"
        className="shadow-sm focus:ring-drossblue focus:border-drossblue block w-full sm:text-sm border-drossblue-light rounded-md text-center"
        placeholder={title}
        title={title}
        value={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        autoFocus
      />
    </div>
  )
}
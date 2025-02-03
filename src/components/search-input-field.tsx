'use client'

import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";

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
      <Input 
        className="text-center"
        type="text" 
        placeholder={title} 
        title={title}
        value={value} 
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        autoFocus
      />
    </div>
  )
}
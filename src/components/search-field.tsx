import { SearchIcon } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

/**
 * The single styled search input shared by every search box on the site, so all
 * of them look identical: the discovery search on the homepage + country
 * landing (`AirportSearchBox`) and the per-country search pages
 * (`SearchInputField`). It renders a relative container with a left magnifier
 * icon, the consistently-styled `Input`, and a slot for the results overlay
 * (`overlay`, which the caller positions via `absolute inset-x-0 top-full`
 * inside this relative box).
 *
 * ONLY the look lives here; all behaviour (debounce, server action, result
 * routing, single-result redirect, ARIA state) stays in the callers, passed
 * through as ordinary input props. Keeping the styling in one place is what
 * stops the three fields from drifting apart again - the shared classes always
 * win over any caller-supplied `className`.
 */
export function SearchField({
  overlay,
  className,
  ...inputProps
}: React.ComponentProps<typeof Input> & { overlay?: React.ReactNode }) {
  return (
    <div className="relative">
      <SearchIcon
        className="text-drossgray-dark pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="text"
        autoComplete="off"
        {...inputProps}
        className={cn(
          className,
          "focus-visible:ring-drossblue border-drossgray-dark/20 h-12 rounded-lg bg-white pl-10 text-base shadow-sm focus-visible:ring-2",
        )}
      />
      {overlay}
    </div>
  );
}

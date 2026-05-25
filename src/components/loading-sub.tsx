import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

export function LoadingSub() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-[40px] sm:px-6 lg:px-8">
        <div className="flex flex-col items-center pt-2 pb-4">
          <Skeleton className="h-6 w-3/4 lg:h-8" />
          <Skeleton className="mt-2 block h-6 w-[200px] md:hidden" />
          <Skeleton className="mt-3 h-4 w-full sm:mt-2 lg:h-6" />
          <Skeleton className="mt-[9px] block h-4 w-full lg:hidden" />
          <Skeleton className="mt-[9px] block h-4 w-5/6 sm:hidden" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Input className="text-center" type="text" disabled />
        <div className="absolute left-1/2 mt-3 w-full max-w-7xl -translate-x-1/2 transform px-4 text-center text-white sm:px-6 lg:px-8">
          <ol></ol>
        </div>
      </div>
    </>
  );
}

import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

export function LoadingSub() {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[40px]">
        <div className="flex flex-col items-center pb-4 pt-2">
          <Skeleton className="h-6 lg:h-8 w-3/4" />
          <Skeleton className="block mt-2 h-6 md:hidden w-[200px]" />
          <Skeleton className="mt-3 sm:mt-2 h-4 lg:h-6 w-full" />
          <Skeleton className="block mt-[9px] h-4 lg:hidden w-full" />
          <Skeleton className="block mt-[9px] h-4 sm:hidden w-5/6" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Input
          className="text-center"
          type="text"
          disabled
        />
        <div className="max-w-7xl px-4 sm:px-6 lg:px-8 text-center mt-3 w-full text-white absolute left-1/2 transform -translate-x-1/2">
          <ol>
          </ol>
        </div>
      </div>

    </>
  );
}
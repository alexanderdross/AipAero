import { cn } from "~/lib/utils";

interface Props {
  className?: string;
  title: string;
  description: string;
}

export function Title({ className, title, description }: Props) {
  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-4 pt-[40px] sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="pb-4 text-center">
        <h1 className="m-0 text-2xl break-words hyphens-auto md:text-3xl lg:text-4xl">
          {title}
        </h1>
        <p className="text-md md:text-md mt-2 break-words hyphens-auto">
          {description}
        </p>
      </div>
    </div>
  );
}

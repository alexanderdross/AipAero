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
        <h1 className="m-0 text-3xl font-bold tracking-tight text-balance break-words hyphens-auto md:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="text-drossgray-dark mx-auto mt-3 max-w-2xl text-base text-balance break-words hyphens-auto md:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}

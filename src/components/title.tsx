import { cn } from "~/lib/utils";

interface Props {
  className?: string;
  title: string;
  description: string;
}

export function Title({ 
  className,
  title, 
  description 
}: Props) {
  return (
    <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
      <div className="text-center pb-4">
          <h1 className="m-0 text-2xl md:text-3xl lg:text-4xl break-words hyphens-auto">{title}</h1>
          <p className="mt-2 text-md md:text-md break-words hyphens-auto">{description}</p>
      </div>
    </div>
  );
}
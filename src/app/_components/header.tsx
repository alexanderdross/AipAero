interface Props {
  title: string;
  description: string;
}

export function Header({ 
  title, 
  description 
}: Props) {
  return (
    <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center py-[40px]">
          <h1 className="m-0 text-2xl md:text-3xl lg:text-4xl break-words hyphens-auto">{title}</h1>
          <p className="m-0 text-md md:text-xl break-words hyphens-auto">{description}</p>
      </div>
    </header>
  );
}

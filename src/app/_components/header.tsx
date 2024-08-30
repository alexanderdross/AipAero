export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center py-[40px]">
          <h1 className="m-0 text-[36px]">{title}</h1>
          <p className="m-0 text-[18px]">{subtitle}</p>
      </div>
    </header>
  );
}

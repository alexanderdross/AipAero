export function AboutBox({
  title,
  isH3 = false,
  children,
}: Readonly<{ title: string; isH3: boolean; children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="border-drossgray-dark/15 bg-drossgray-dark/10 mt-16 flex flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center shadow-sm">
        {isH3 && <h3 className="!text-[1.125rem] font-medium">{title}</h3>}
        {!isH3 && <h2 className="!text-[1.125rem] font-medium">{title}</h2>}
        <p>{children}</p>
      </div>
    </div>
  );
}

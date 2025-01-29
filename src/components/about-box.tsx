export function AboutBox({
  title,
  isH3 = false,
  children
}: Readonly<{ title: string; isH3: boolean; children: React.ReactNode; }>) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center items-center text-center mt-16 border border-[#ccc] p-4">
        {isH3 && <h3 className="!text-[1.125rem] font-medium">{title}</h3>}
        {!isH3 && <h2 className="!text-[1.125rem] font-medium">{title}</h2>}
        <p>{children}</p>
      </div>
    </div>
  );
}
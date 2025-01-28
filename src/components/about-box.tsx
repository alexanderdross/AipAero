export function AboutBox({
  title,
  children
}: Readonly<{ title: string; children: React.ReactNode; }>) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center items-center text-center mt-16 border border-[#ccc] p-4">
        <h3 className="!text-[1.125rem] font-medium">{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
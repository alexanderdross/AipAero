import Link from "next/link";

export function Box({
  title,
  description,
  buttons,
}: {
  title: string;
  description: string;
  buttons?: { href: string; hrefTitle: string, title?: string }[];
}) {
  return (
    <div className="bg-white py-8 px-6 border border-[#ccc]">
      <div className="flex flex-col justify-between h-full">
        <div>
          <h2 className="text-center text-2xl font-normal">{title}</h2>
          <p className="text-center">{description}</p>
        </div>
        {buttons?.map((b) => (
          <Link
            key={b.hrefTitle}
            href={b.href}
            title={b.hrefTitle}
            className="text-white bg-drossblue py-2 px-4 hover:underline w-full whitespace-nowrap text-center mt-2"
            target="_self"
            rel="noopener"
          >
            {b.title ?? b.hrefTitle}
          </Link>
        ))}
      </div>
    </div>
  ); 
}

import Link from "next/link";

interface Props {
  title: string;
  description: string;
  buttons?: { href: string; hrefTitle: string, title?: string }[];
}

export function Box({
  title,
  description,
  buttons,
}: Props) {
  return (
    <div className="bg-white py-8 px-6 border border-[#ccc]">
      <div className="flex flex-col justify-between h-full break-words hyphens-auto" lang="de">
        <div>
          <h2 className="text-center text-2xl font-normal">{title}</h2>
          <p className="text-center">{description}</p>
        </div>
        {buttons?.map((b) => (
          <Link
            key={b.hrefTitle}
            href={b.href}
            title={b.hrefTitle}
            className="text-white bg-drossblue py-2 px-4 hover:underline w-full text-center mt-2 break-words hyphens-auto"
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

import Link from "next/link";

interface Props {
  title: string;
  description: string;
  buttons?: { href: string; hrefTitle: string; title?: string }[];
}

export function Box({ title, description, buttons }: Props) {
  return (
    <div className="border border-[#ccc] bg-white px-6 py-8">
      <div
        className="flex h-full flex-col justify-between hyphens-auto break-words"
        lang="de"
      >
        <div>
          <h2 className="text-center text-2xl font-normal">{title}</h2>
          <p className="text-center">{description}</p>
        </div>
        {buttons?.map((b) => (
          <Link
            key={b.hrefTitle}
            href={b.href}
            title={b.hrefTitle}
            className="mt-2 w-full hyphens-auto break-words bg-drossblue px-4 py-2 text-center text-white hover:underline"
            target="_self"
            rel="noopener"
            scroll={true}
          >
            {b.title ?? b.hrefTitle}
          </Link>
        ))}
      </div>
    </div>
  );
}

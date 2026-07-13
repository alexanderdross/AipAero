import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";

interface Button {
  href: string;
  hrefTitle: string;
  title?: string;
  variant?: "primary" | "secondary";
}

interface Props {
  title: string;
  description: string;
  buttons?: Button[];
  /** Optional decorative icon or flag shown above the heading (aria-hidden). */
  icon?: React.ReactNode;
  /** Optional row of pills hinting at what the card links to (e.g. chart types). */
  badges?: string[];
  /**
   * BCP-47 language of the card copy, used so `hyphens-auto` breaks words with
   * the right dictionary. Defaults to unset (browser guesses from the document).
   */
  lang?: string;
  /**
   * Optional anchor id (deep-linkable card, e.g. /#germany). Adds a scroll
   * margin so the sticky header never covers the jump target.
   */
  id?: string;
}

const buttonBase =
  "group/btn mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center font-medium break-words hyphens-auto transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-drossblue focus-visible:ring-offset-2";

const buttonVariants = {
  primary: "bg-drossblue text-white hover:bg-drossblue-light",
  secondary:
    "border border-drossblue bg-white text-drossblue hover:bg-drossblue hover:text-white",
} as const;

export function Box({
  title,
  description,
  buttons,
  icon,
  badges,
  lang,
  id,
}: Props) {
  return (
    <div
      id={id}
      className={cn(
        "group border-drossgray-dark/15 hover:border-drossblue/40 flex flex-col rounded-xl border bg-white p-6 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md",
        id && "scroll-mt-24",
      )}
    >
      <div
        className="flex h-full flex-col justify-between break-words hyphens-auto"
        lang={lang}
      >
        <div>
          {icon && (
            <div
              className="text-drossblue mb-3 flex justify-center"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <h2 className="text-center text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-drossgray-dark mt-1 text-center">{description}</p>
          {badges && badges.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
              {badges.map((b) => (
                <li
                  key={b}
                  className="border-drossblue/20 bg-drossblue/5 text-drossblue inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {buttons?.map((b) => {
            const variant = b.variant ?? "primary";
            return (
              <Link
                key={b.hrefTitle}
                href={b.href}
                title={b.hrefTitle}
                className={cn(buttonBase, buttonVariants[variant])}
                target="_self"
                rel="noopener"
                scroll={true}
              >
                <span>{b.title ?? b.hrefTitle}</span>
                {variant === "primary" && (
                  <ArrowRightIcon
                    className="size-4 flex-shrink-0 transition-transform group-hover/btn:translate-x-0.5"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

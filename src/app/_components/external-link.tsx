interface Props {
  children: React.ReactNode;
  href: string;
  hrefTitle: string;
  className?: string;
}

export function ExternalLink({
  children,
  href,
  hrefTitle,
  className
}: Props) {
  return <a
    href={href}
    title={hrefTitle}
    aria-label={hrefTitle}
    target="_blank"
    rel="noopener, noreferrer, noindex, nofollow"
    className={className}
  >
    {children}
  </a>;
}
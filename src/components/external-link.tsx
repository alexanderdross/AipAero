interface Props {
  children: React.ReactNode;
  href: string;
  hrefTitle: string;
  className?: string;
  // Override the default `rel`. Defaults to the site-wide outbound policy
  // (noopener/noreferrer/nofollow). Owned, topically-relevant cross-links
  // (e.g. the Trade:Aero sister property) pass `rel="noopener"` so the link is
  // followed and Trade:Aero receives the referrer for attribution.
  rel?: string;
}

export function ExternalLink({
  children,
  href,
  hrefTitle,
  className,
  rel = "noopener noreferrer nofollow",
}: Props) {
  return (
    <a
      href={href}
      title={hrefTitle}
      aria-label={hrefTitle}
      target="_blank"
      rel={rel}
      className={className}
    >
      {children}
    </a>
  );
}

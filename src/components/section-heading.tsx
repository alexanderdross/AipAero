/**
 * Slug for a section heading's anchor id / hash: lowercased, diacritics stripped,
 * non-alphanumerics collapsed to hyphens. Derived from the localized heading text
 * so the hash reads naturally per locale ("Wetter" -> #wetter, "Weather" ->
 * #weather, "In der Naehe" -> #in-der-nahe).
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A gadget-box section heading (`<h2>`) that doubles as its own anchor: it carries
 * an `id` derived from its text and links to `#<id>`, so every section on the
 * airport-detail pages is deep-linkable (a "#" fades in on hover for affordance).
 * A plain HTML anchor - works without JS and in both server and client parents.
 */
export function SectionHeading({
  children,
  className,
  linkTitle,
}: {
  children: string;
  className?: string;
  /** Optional SEO/discovery title attribute for the self-anchor link. */
  linkTitle?: string;
}) {
  const slug = slugify(children);
  return (
    <h2 id={slug} className={className}>
      <a
        href={`#${slug}`}
        title={linkTitle}
        className="group inline-flex items-center gap-x-1.5 hover:underline"
      >
        {children}
        <span
          aria-hidden="true"
          className="text-drossblue/50 opacity-0 transition-opacity group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </h2>
  );
}

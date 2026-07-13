import { getTranslations } from "next-intl/server";
import { HashDetailsOpener } from "~/components/hash-details-opener";
import { SectionHeading, slugify } from "~/components/section-heading";
import { getPathname } from "~/i18n/routing";
import { orgUrl } from "~/lib/utils";

/**
 * Country-specific FAQ for the locale landing pages: four questions distilled
 * from the Search Console query clusters ("aip <country>", the free/PDF
 * cluster, chart-type queries, offline/EFB), answered with per-country facts
 * (publisher/ANSP, available chart types) inlined in each locale file - so
 * de/at or the 19 English variants never share identical copy (no
 * near-duplicate content). Rendered as a native <details> accordion (project
 * accordion conventions in CLAUDE.md): SSR-collapsed (no CLS), zero client JS
 * except the shared HashDetailsOpener island, every question a hash
 * deep-link with an SEO title attribute, and the answers carry internal
 * links (type pages, airport list, EFB guide) for linking density. The
 * FAQPage JSON-LD is emitted from the SAME strings as the visible text
 * (never markup-only); page-emitted JSON-LD is safe here because the country
 * landing pages are prerendered (CLAUDE.md JSON-LD gotcha).
 */
export async function CountryFaq({ locale }: { locale: string }) {
  const t = await getTranslations("CountryFaq");
  const tMenu = await getTranslations("Menu");
  const tFooter = await getTranslations("Footer");

  const canonical = (href: Parameters<typeof getPathname>[0]["href"]) => {
    const path = getPathname({ href, locale });
    return path.endsWith("/") ? path : path + "/";
  };
  const efbHref = canonical("/efb");

  // Inline-link tags used by the locale files' answers. Only the tags present
  // in a country's messages are rendered; Menu carries the localized SEO
  // hrefTitles for exactly the pages that country exposes.
  const linkTargets: Record<string, { href: string; menuKey: string }> = {
    list: { href: canonical("/airport-list"), menuKey: "airports" },
    vfr: { href: canonical("/vfr"), menuKey: "vfr" },
    ifr: { href: canonical("/ifr"), menuKey: "ifr" },
    heli: { href: canonical("/heliports"), menuKey: "heliports" },
    mil: { href: canonical("/military"), menuKey: "military" },
    aero: { href: canonical("/aeroports"), menuKey: "aeroports" },
  };
  const richHandlers = Object.fromEntries(
    Object.entries(linkTargets).map(([tag, { href, menuKey }]) => [
      tag,
      (chunks: React.ReactNode) => (
        <a
          href={href}
          title={
            tMenu.has(`${menuKey}.hrefTitle`)
              ? tMenu(`${menuKey}.hrefTitle`)
              : undefined
          }
          className="text-drossblue underline"
        >
          {chunks}
        </a>
      ),
    ]),
  );
  // Strip ALL inline-link tags for the JSON-LD text.
  const markupStrip = Object.fromEntries(
    [...Object.keys(linkTargets), "efb"].map((tag) => [
      tag,
      (chunks: string) => chunks,
    ]),
  );

  const nums = [1, 2, 3, 4] as const;
  // Canonical page URL for the schema @id/url values: each Question's @id is
  // its hash deep link (the accordion ids), so crawlers/LLMs get a directly
  // citable jump target per question.
  const pageUrl = new URL(canonical("/"), orgUrl).toString();
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#${slugify(t("title"))}`,
    url: pageUrl,
    mainEntity: nums.map((i) => {
      const anchor = `${pageUrl}#${slugify(t(`q${i}`))}`;
      return {
        "@type": "Question",
        "@id": anchor,
        url: anchor,
        name: t(`q${i}`),
        acceptedAnswer: {
          "@type": "Answer",
          text: t.markup(`a${i}`, markupStrip),
        },
      };
    }),
  };

  return (
    // max-w-3xl: the card hugs its content instead of floating text inside a
    // much wider box (owner feedback on padding).
    <div className="mx-auto mt-16 max-w-3xl px-4 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
      />
      <HashDetailsOpener />
      <div className="border-drossgray-dark/15 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <SectionHeading
          linkTitle={`${t("title")} - ${t("q1")}`}
          className="text-center text-xl font-semibold tracking-tight"
        >
          {t("title")}
        </SectionHeading>
        {/* Native <details> accordion: no client JS (the HashDetailsOpener
            island only reacts to hash navigation), SSR-collapsed (no CLS),
            and the answers stay in the crawlable HTML - same pattern as the
            METAR decode tab. */}
        <div className="divide-drossgray-dark/10 mt-4 divide-y">
          {nums.map((i) => {
            const q = t(`q${i}`);
            const slug = slugify(q);
            return (
              <details key={i} id={slug} className="group scroll-mt-24 py-1">
                <summary
                  title={q}
                  className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-x-2 py-2 [&::-webkit-details-marker]:hidden"
                >
                  <h3 className="font-semibold">{q}</h3>
                  <span
                    aria-hidden="true"
                    className="text-drossgray-dark shrink-0 transition-transform group-open:rotate-90"
                  >
                    ›
                  </span>
                </summary>
                <p className="text-drossgray-dark pb-3">
                  {t.rich(`a${i}`, {
                    ...richHandlers,
                    // Permanent underline everywhere: links in body copy must
                    // be recognizable without color (axe link-in-text-block).
                    efb: (chunks) => (
                      <a
                        href={efbHref}
                        title={tFooter("efb.hrefTitle")}
                        className="text-drossblue underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

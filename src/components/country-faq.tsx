import { getTranslations } from "next-intl/server";
import { SectionHeading } from "~/components/section-heading";
import { getPathname } from "~/i18n/routing";

/**
 * Country-specific FAQ for the locale landing pages: four questions distilled
 * from the Search Console query clusters ("aip <country>", the free/PDF
 * cluster, chart-type queries, offline/EFB), answered with per-country facts
 * (publisher/ANSP, available chart types) inlined in each locale file - so
 * de/at or the 19 English variants never share identical copy (no
 * near-duplicate content). Fully server-rendered on a statically prerendered
 * page: zero client JS, no CLS, and the FAQPage JSON-LD is emitted from the
 * SAME strings as the visible text (never markup-only - Google requires the
 * schema to mirror visible content; page-emitted JSON-LD is safe here because
 * the country landing pages are prerendered, see the CLAUDE.md JSON-LD
 * gotcha).
 */
export async function CountryFaq({ locale }: { locale: string }) {
  const t = await getTranslations("CountryFaq");
  const tFooter = await getTranslations("Footer");
  const efbPath = getPathname({ href: "/efb", locale });
  const efbHref = efbPath.endsWith("/") ? efbPath : efbPath + "/";

  const nums = [1, 2, 3, 4] as const;
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: nums.map((i) => ({
      "@type": "Question",
      name: t(`q${i}`),
      acceptedAnswer: {
        "@type": "Answer",
        // Strip the inline-link tag (a4's <efb>) - JSON-LD carries text.
        text: t.markup(`a${i}`, { efb: (chunks) => chunks }),
      },
    })),
  };

  return (
    <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
      />
      <div className="border-drossgray-dark/15 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <SectionHeading className="text-center text-xl font-semibold tracking-tight">
          {t("title")}
        </SectionHeading>
        <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-5">
          {nums.map((i) => (
            <div key={i}>
              <h3 className="font-semibold">{t(`q${i}`)}</h3>
              <p className="text-drossgray-dark mt-1">
                {t.rich(`a${i}`, {
                  // Permanent underline: links in body copy must be
                  // recognizable without color (axe link-in-text-block).
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

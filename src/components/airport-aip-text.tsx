import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";

/**
 * DE-only raw AD-2 text block. DFS BasicVFR serves each aerodrome's AD-2 book
 * page as a base64 PNG image, so the sole route to any DE AD-2 datum is OCR of
 * that image (see `crawlers/crawlers/de_ocr.py`). This box shows that OCR text
 * verbatim, under a PROMINENT, always-visible caveat that it was machine-read
 * and must be verified against the official AIP.
 *
 * Safety (owner directive): the text is DISPLAY-ONLY. It is never parsed into
 * the open/closed badge, the map's operating-hours filter, `hoursStructured`,
 * or the Airport JSON-LD - a mis-OCR'd digit in an operating-hours window must
 * never become a machine claim under the project's "never assert a wrong open"
 * rule. So this component renders text and a source link, nothing more.
 */
export async function AirportAipText({
  text,
  sourceUrl,
  locale,
}: {
  text: string;
  /** The official DFS AIP page for this field (the crawler's stored `url`). */
  sourceUrl: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "Weather" });

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading
        className="text-center text-xl font-normal"
        linkTitle={t("aipText")}
      >
        {t("aipText")}
      </SectionHeading>

      {/* Always-visible caveat - the raw text is machine-read, so the reader
          must see this before (and whether or not) they expand the block. */}
      <p
        role="note"
        className="mt-3 flex items-start gap-x-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      >
        <TriangleAlertIcon
          className="mt-0.5 h-4 w-4 flex-shrink-0"
          aria-hidden="true"
        />
        <span>{t("aipTextCaveat")}</span>
      </p>

      <details className="mt-3 text-sm">
        <summary
          title={t("aipText")}
          className="text-drossblue cursor-pointer text-center hover:underline"
        >
          {t("aipTextShow")}
        </summary>
        {/* Verbatim OCR text: pre-wrapped so line breaks survive, but wrapping
            so it never overflows on mobile. */}
        <p className="text-drossgray-dark mt-2 leading-relaxed whitespace-pre-wrap">
          {text}
        </p>
        <p className="mt-3 text-center">
          <ExternalLink
            href={sourceUrl}
            hrefTitle={t("aipTextSource")}
            className="text-drossblue hover:underline"
          >
            {t("aipTextSource")}
          </ExternalLink>
        </p>
      </details>
    </section>
  );
}

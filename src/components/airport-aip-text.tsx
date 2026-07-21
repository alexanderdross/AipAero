import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";
import { segmentAd2Text, splitSubItems } from "~/lib/ad2-sections";

/**
 * DE-only raw AD-2 text block. DFS BasicVFR serves each aerodrome's AD-2 book
 * page as a base64 PNG image, so the sole route to any DE AD-2 datum is OCR of
 * that image (see `crawlers/crawlers/de_ocr.py`). This box shows that OCR text
 * under a PROMINENT, always-visible caveat that it was machine-read and must be
 * verified against the official AIP.
 *
 * Presentation: the OCR blob is segmented into its ICAO AD 2.x sections
 * (`segmentAd2Text`) and rendered with clean headings, DROPPING the sections
 * whose data already appears in a dedicated structured box (operating hours,
 * runways, frequencies, location, weather). When the blob cannot be confidently
 * segmented it falls back to the verbatim single-paragraph render. The section
 * BODY prose is never rewritten - only a clean heading is added and redundant
 * whole sections are hidden - so a mis-OCR'd datum is never restated as fact.
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
  lang,
}: {
  text: string;
  /** The official DFS AIP page for this field (the crawler's stored `url`). */
  sourceUrl: string;
  locale: string;
  /** Language of the passed OCR blob ("de" for the native page, else "en") -
   * resolved by the caller so the section titles match the blob exactly (a DE
   * airport under the /de/en locale reads the English blob). */
  lang: "de" | "en";
}) {
  const t = await getTranslations({ locale, namespace: "Weather" });

  // Keep only the non-redundant sections for display (the rest are shown in
  // their own structured boxes). Null -> verbatim fallback below.
  const sections = segmentAd2Text(text, lang)?.filter((s) => !s.redundant);

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
        {/* Sectioned view: clean AD 2.x headings + the (verbatim) OCR body,
            redundant sections already dropped. Falls back to the single
            verbatim paragraph when the blob could not be segmented. The body
            stays pre-wrapped + wrapping so it never overflows on mobile. */}
        {sections && sections.length > 0 ? (
          <div className="mt-2 space-y-3">
            {sections.map((s, i) => {
              // Break a long numbered section (esp. AD 2.20 local regulations)
              // into its sub-items so it reads as a list, not a wall; a plain
              // single-paragraph section yields one item and renders as before.
              const items = splitSubItems(s.body);
              return (
                <div key={s.code ?? `x${i}`}>
                  <h3 className="text-drossgray-dark font-semibold">
                    {s.title}
                  </h3>
                  {items.length > 1 ? (
                    <div className="mt-1 space-y-1.5">
                      {items.map((item, j) => (
                        <p
                          key={j}
                          className="text-drossgray-dark leading-relaxed whitespace-pre-wrap"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  ) : (
                    s.body && (
                      <p className="text-drossgray-dark leading-relaxed whitespace-pre-wrap">
                        {s.body}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-drossgray-dark mt-2 leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        )}
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

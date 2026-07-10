import { FileTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";

/**
 * Chart-PDF box, shown only when the airport's chart URL points directly at a
 * PDF (`isPdfUrl`). Offers a clear "open PDF" link plus an optional inline
 * preview in a collapsible `<details>`. The preview is best-effort: the browser's
 * native PDF viewer via `<object>`, which is blocked by the host's
 * `X-Frame-Options` on some sources - the `<object>` fallback then shows the open
 * link, so there is never a dead empty box. A same-origin, always-working preview
 * (PDF.js + offline) needs the self-hosting path - see docs/aip-hosting-rights.md.
 */
export async function AirportChart({ url }: { url: string }) {
  const t = await getTranslations("Chart");

  const openLink = (className: string) => (
    <ExternalLink href={url} hrefTitle={t("openPdf")} className={className}>
      <FileTextIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{t("openPdf")}</span>
    </ExternalLink>
  );

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-center text-xl font-normal">{t("title")}</h2>

      <p className="mt-3 text-center text-sm">
        {openLink(
          "text-drossblue inline-flex items-center gap-x-1 hover:underline",
        )}
      </p>

      <details className="mt-3 text-sm">
        <summary className="text-drossblue cursor-pointer text-center hover:underline">
          {t("preview")}
        </summary>
        <object
          data={url}
          type="application/pdf"
          className="border-drossgray-dark/15 mt-2 h-[75vh] w-full rounded-lg border"
        >
          {/* Shown when the host blocks framing (X-Frame-Options) */}
          <p className="p-4 text-center">
            {openLink(
              "text-drossblue inline-flex items-center gap-x-1 hover:underline",
            )}
          </p>
        </object>
      </details>
    </section>
  );
}

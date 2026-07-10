"use client";

import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { ExternalLink } from "~/components/external-link";

/**
 * Lazy, on-click PDF preview for the approach-chart box. The heavy native PDF
 * embed (`<object>`) is only mounted once the user opens the `<details>`, so the
 * PDF is never fetched on page load - previously the `<object>` sat inside the
 * collapsed `<details>` and browsers fetch embed/object resources even while
 * hidden, loading the full chart PDF (and spinning up the PDF viewer) on every
 * detail page. Once opened it stays mounted, so re-collapsing does not refetch.
 * No-JS users keep the primary "open PDF" link rendered server-side above this.
 */
export function ChartPreview({
  url,
  previewLabel,
  openLabel,
}: {
  url: string;
  previewLabel: string;
  openLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <details
      className="mt-3 text-sm"
      onToggle={(e) => {
        // Mount the embed on first open only; never unmount, so toggling the
        // preview shut and open again does not refetch the PDF.
        if (e.currentTarget.open) setLoaded(true);
      }}
    >
      <summary className="text-drossblue cursor-pointer text-center hover:underline">
        {previewLabel}
      </summary>
      {loaded && (
        <object
          data={url}
          type="application/pdf"
          className="border-drossgray-dark/15 mt-2 h-[75vh] w-full rounded-lg border"
        >
          {/* Shown when the host blocks framing (X-Frame-Options) */}
          <p className="p-4 text-center">
            <ExternalLink
              href={url}
              hrefTitle={openLabel}
              className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
            >
              <FileTextIcon
                className="h-4 w-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{openLabel}</span>
            </ExternalLink>
          </p>
        </object>
      )}
    </details>
  );
}

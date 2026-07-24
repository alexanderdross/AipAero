"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

/**
 * A small "copy ICAO" affordance next to the EFB hand-off links: pilots paste
 * the code straight into ForeFlight / SkyDemon & Co. (whose deep-link schemes
 * are deliberately NOT wired - undocumented and silently failing without the
 * app, see efb-links.ts). Client-only (clipboard needs the browser); fully
 * degradable - if the Clipboard API is unavailable the click is a no-op, the
 * ICAO is still shown in the heading. Labels are passed in already localized so
 * this island ships no message payload.
 */
export function CopyIcaoButton({
  icao,
  copyLabel,
  copiedLabel,
}: {
  icao: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(icao);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked / unavailable - fail soft (the code is on the page).
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${copyLabel}: ${icao}`}
      aria-label={`${copyLabel}: ${icao}`}
      className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      ) : (
        <CopyIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}

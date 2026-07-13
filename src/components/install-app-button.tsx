"use client";

import { MonitorDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  hasInstallPrompt,
  isStandalone,
  promptInstall,
} from "~/lib/install-prompt";

/**
 * "Install now" button for the EFB guide's install section: fires the NATIVE
 * install dialog via the captured `beforeinstallprompt` (Chromium on
 * Android/desktop). Where no programmatic install exists (iOS/macOS Safari,
 * already installed, criteria not met) it renders nothing - the manual
 * tap-sequence instructions next to it remain the accessible path, so the
 * button is pure progressive enhancement. It sits below the fold in a static
 * section, so its post-hydration appearance costs no CLS on SEO content.
 */
export function InstallAppButton({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    // The single-use prompt event may have been captured before this mounts
    // (module-scope listener in install-prompt.ts) or fire afterwards.
    if (hasInstallPrompt()) setVisible(true);
    const onPrompt = () => setVisible(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void promptInstall().then((outcome) => {
          if (outcome !== "dismissed") setVisible(false);
        });
      }}
      title={label}
      className="bg-drossblue hover:bg-drossblue-light mt-3 inline-flex min-h-10 items-center gap-x-2 rounded-lg px-4 py-2 font-medium text-white transition-colors"
    >
      <MonitorDownIcon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

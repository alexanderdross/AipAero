// PWA install-prompt helper (client-only; guarded for SSR evaluation).
//
// Chromium (Android/desktop) fires `beforeinstallprompt` when the app is
// installable and not yet installed. We capture it at module scope - as early
// as the client bundle loads - so a later user gesture (the "save for
// offline" button) can trigger the NATIVE install dialog. There is no
// programmatic install on iOS/Safari; callers show a manual
// "Share -> Add to Home Screen" hint instead (see `isIos`).

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Chrome would otherwise show its own mini-infobar at its own timing;
    // deferring it hands the moment to our save button.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
}

/**
 * Show the native install dialog (Chromium only). Must be called from a user
 * gesture. Resolves with the user's choice, or "unavailable" when no deferred
 * prompt exists (already installed, unsupported browser, or criteria not met).
 */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  // A prompt event is single-use.
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

/** Already running as an installed app (home-screen launch)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    // iOS Safari's non-standard flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (incl. iPadOS masquerading as macOS with touch support). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

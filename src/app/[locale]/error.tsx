"use client";

import { useEffect, useState } from "react";

type Props = {
  error: Error & { digest?: string };
  reset(): void;
};

// An error boundary is a client component and receives no route params, and the
// locale layout provides no next-intl client context - and, more to the point,
// a broken i18n load could be the very thing that threw. So the copy lives in
// code (the metar-decode glossary precedent) and the language is read from the
// server-set `<html lang>` on mount, not from next-intl. The primary content
// languages are covered; every other locale falls back to English.
const MESSAGES: Record<string, { oops: string; retry: string }> = {
  en: { oops: "Something went wrong.", retry: "Try again" },
  de: { oops: "Etwas ist schiefgelaufen.", retry: "Erneut versuchen" },
  fr: { oops: "Une erreur s'est produite.", retry: "Réessayer" },
  nl: { oops: "Er is iets misgegaan.", retry: "Opnieuw proberen" },
};

export default function Error({ error, reset }: Props) {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    console.error(error);
    const l = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (l && l in MESSAGES) setLang(l);
  }, [error]);
  const t = MESSAGES[lang] ?? MESSAGES.en!;

  // `flex` (not just `flex-col`) so the column layout and centering apply, and a
  // visible link colour (the previous `text-white` button was invisible on the
  // light page background).
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="mt-4">{t.oops}</p>
      <button
        className="text-drossblue mt-2 underline underline-offset-2"
        onClick={reset}
        type="button"
      >
        {t.retry}
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  error: Error & { digest?: string };
  reset(): void;
};

// An error boundary is a client component and receives no route params, and the
// locale layout provides no next-intl client context - and, more to the point,
// a broken i18n load could be the very thing that threw. So the copy lives in
// code (the metar-decode glossary precedent) and the language is read from the
// server-set `<html lang>` on mount, not from next-intl. The site's main content
// languages are covered; every other locale falls back to English.
interface Copy {
  title: string;
  retry: string;
  home: string;
}
const MESSAGES: Record<string, Copy> = {
  en: {
    title: "Something went wrong.",
    retry: "Try again",
    home: "Back to homepage",
  },
  de: {
    title: "Etwas ist schiefgelaufen.",
    retry: "Erneut versuchen",
    home: "Zur Startseite",
  },
  fr: {
    title: "Une erreur s'est produite.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
  },
  nl: {
    title: "Er is iets misgegaan.",
    retry: "Opnieuw proberen",
    home: "Naar de startpagina",
  },
  es: {
    title: "Algo salió mal.",
    retry: "Reintentar",
    home: "Volver al inicio",
  },
  it: {
    title: "Qualcosa è andato storto.",
    retry: "Riprova",
    home: "Torna alla home",
  },
  pt: {
    title: "Algo correu mal.",
    retry: "Tentar novamente",
    home: "Voltar ao início",
  },
  pl: {
    title: "Coś poszło nie tak.",
    retry: "Spróbuj ponownie",
    home: "Wróć do strony głównej",
  },
  sv: {
    title: "Något gick fel.",
    retry: "Försök igen",
    home: "Till startsidan",
  },
  no: { title: "Noe gikk galt.", retry: "Prøv igjen", home: "Til forsiden" },
  da: { title: "Noget gik galt.", retry: "Prøv igen", home: "Til forsiden" },
  cs: {
    title: "Něco se pokazilo.",
    retry: "Zkusit znovu",
    home: "Zpět na úvod",
  },
  fi: {
    title: "Jokin meni pieleen.",
    retry: "Yritä uudelleen",
    home: "Etusivulle",
  },
  hu: {
    title: "Valami elromlott.",
    retry: "Újrapróbálkozás",
    home: "Vissza a főoldalra",
  },
  el: {
    title: "Κάτι πήγε στραβά.",
    retry: "Δοκιμάστε ξανά",
    home: "Αρχική σελίδα",
  },
  ro: {
    title: "Ceva n-a mers bine.",
    retry: "Încearcă din nou",
    home: "Înapoi la pagina principală",
  },
  tr: {
    title: "Bir şeyler yanlış gitti.",
    retry: "Tekrar dene",
    home: "Ana sayfaya dön",
  },
  ru: { title: "Что-то пошло не так.", retry: "Повторить", home: "На главную" },
};

export default function Error({ error, reset }: Props) {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    console.error(error);
    const l = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (l && l in MESSAGES) setLang(l);
  }, [error]);
  const t = MESSAGES[lang] ?? MESSAGES.en!;

  // `flex` (not just `flex-col`) so the column layout and centering apply, and
  // visible link colours (a previous `text-white` button was invisible on the
  // light page background). A heading + a homepage link give the user a way out
  // when "Try again" keeps failing.
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-drossgray-dark text-xl font-semibold">{t.title}</h1>
      <div className="flex items-center gap-4">
        <button
          className="text-drossblue underline underline-offset-2"
          onClick={reset}
          type="button"
        >
          {t.retry}
        </button>
        <Link
          className="text-drossblue underline underline-offset-2"
          href="/"
          title={t.home}
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}

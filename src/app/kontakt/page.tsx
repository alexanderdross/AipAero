import type { Metadata, ResolvingMetadata } from "next";
import { ContactForm, type ContactFormLabels } from "~/components/contact-form";
import {
  LegalBreadcrumbJsonLd,
  LegalShell,
  legalMetadata,
} from "~/components/legal-shell";
import { CONTACT_RECIPIENT, turnstileSiteKey } from "~/lib/contact";
import { sanitizeIcao, sanitizeRef } from "~/lib/contact-link";
import { orgUrl } from "~/lib/utils";

const EN = new URL("/contact/", orgUrl).toString();
const DE = new URL("/de/kontakt/", orgUrl).toString();

// Rendered at request time (not prerendered): the public Turnstile site key is
// a runtime Worker var, absent during `next build`. See src/app/contact/page.tsx.
export const dynamic = "force-dynamic";

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Kontakt - AIP:Aero",
    description:
      "Kontakt zu AIP:Aero - schreiben Sie uns zu Anflugkarten, Flugplatzdaten, Korrekturen oder Kooperationsanfragen.",
    canonical: DE,
    lang: "de",
    enHref: EN,
    deHref: DE,
  });
}

const labels: ContactFormLabels = {
  name: "Ihr Name",
  email: "Ihre E-Mail",
  icao: "ICAO-Code (optional)",
  subject: "Betreff",
  message: "Nachricht",
  send: "Nachricht senden",
  sending: "Wird gesendet...",
  success:
    "Vielen Dank - Ihre Nachricht wurde gesendet. Wir melden uns in Kürze.",
  error:
    "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt.",
  unavailable:
    "Das Kontaktformular ist derzeit nicht verfügbar. Bitte schreiben Sie uns direkt an info@aip.aero.",
  verifying:
    "Bitte schließen Sie die Sicherheitsprüfung ab und versuchen Sie es erneut.",
};

const inlineLink = "text-drossblue underline";

/**
 * Liest eine Flugplatz-Referenz aus der Query (eine Detailseite verlinkt hierher
 * als `/de/kontakt/?icao=EDNY`, oder `?ref=<slug>` fuer ICAO-lose Felder) und
 * leitet das vorbefuellte ICAO-Feld + Betreff + Nachricht ab. Die Seite ist
 * force-dynamic, das Lesen kostet nichts und die Canonical bleibt parameterlos.
 */
function prefillFromParams(sp: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const icao = sanitizeIcao(first(sp.icao));
  const ref = icao ? null : sanitizeRef(first(sp.ref));
  const label = icao ?? ref;
  if (!label) return {};
  return {
    initialIcao: icao ?? "",
    initialSubject: `Datenkorrektur: ${label.toUpperCase()}`,
    initialMessage: `Bitte beschreiben Sie, welche Angabe zu ${label.toUpperCase()} fehlt oder falsch ist:\n\n`,
  };
}

export default async function KontaktPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = prefillFromParams(await searchParams);
  return (
    <LegalShell
      lang="de"
      title="Kontakt"
      intro="Fragen, Korrekturen oder eine Kooperationsidee? Schreiben Sie uns."
      altLink={{
        href: "/contact/",
        label: "English",
        hrefLang: "en",
        title: "Contact - English version",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Kontakt" url={DE} />}
    >
      <section>
        <p>
          Nutzen Sie das folgende Formular, um das AIP:Aero-Team zu erreichen.
          Sie können uns auch direkt unter{" "}
          <a
            href={`mailto:${CONTACT_RECIPIENT}`}
            title="AIP:Aero unter info@aip.aero per E-Mail erreichen"
            className={inlineLink}
          >
            {CONTACT_RECIPIENT}
          </a>{" "}
          schreiben.
        </p>
        <div className="mt-6">
          <ContactForm
            siteKey={turnstileSiteKey()}
            labels={labels}
            {...prefill}
          />
        </div>
      </section>
    </LegalShell>
  );
}

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
// a runtime Worker var, absent during `next build`. A static prerender would
// bake in the unconfigured "unavailable" fallback; a dynamic render reads the
// live key. The page is lightweight (no DB), so the render cost is negligible,
// and generateMetadata still lands in <head> via next.config's htmlLimitedBots.
export const dynamic = "force-dynamic";

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Contact - AIP:Aero",
    description:
      "Contact AIP:Aero - send us a message about approach charts, airport data, corrections or partnership enquiries.",
    canonical: EN,
    lang: "en",
    enHref: EN,
    deHref: DE,
  });
}

const labels: ContactFormLabels = {
  name: "Your name",
  email: "Your email",
  icao: "ICAO code (optional)",
  subject: "Subject",
  message: "Message",
  send: "Send message",
  sending: "Sending...",
  success:
    "Thank you - your message has been sent. We will get back to you soon.",
  error: "Something went wrong. Please try again or email us directly.",
  unavailable:
    "The contact form is currently unavailable. Please email us directly at info@aip.aero.",
  verifying: "Please complete the human-verification check and try again.",
};

const inlineLink = "text-drossblue underline";

/**
 * Read an aerodrome reference from the query (an airport detail page links here
 * as `/contact/?icao=EDNY`, or `?ref=<slug>` for an ICAO-less field) and derive
 * the pre-filled ICAO input + subject + message. The page is force-dynamic, so
 * reading searchParams costs nothing and the canonical stays param-free.
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
    initialSubject: `Data correction: ${label.toUpperCase()}`,
    initialMessage: `Please describe what is incorrect or missing for ${label.toUpperCase()}:\n\n`,
  };
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = prefillFromParams(await searchParams);
  return (
    <LegalShell
      lang="en"
      title="Contact"
      intro="Questions, corrections or a partnership idea? Send us a message."
      altLink={{
        href: "/de/kontakt/",
        label: "Deutsch",
        hrefLang: "de",
        title: "Kontakt - deutsche Fassung",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Contact" url={EN} />}
    >
      <section>
        <p>
          Use the form below to reach the AIP:Aero team. You can also email us
          directly at{" "}
          <a
            href={`mailto:${CONTACT_RECIPIENT}`}
            title="Email AIP:Aero at info@aip.aero"
            className={inlineLink}
          >
            {CONTACT_RECIPIENT}
          </a>
          .
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

import type { Metadata, ResolvingMetadata } from "next";
import { ExternalLink } from "~/components/external-link";
import {
  LegalBreadcrumbJsonLd,
  LegalShell,
  legalMetadata,
} from "~/components/legal-shell";
import { SectionHeading } from "~/components/section-heading";
import { IMPRINT } from "~/lib/legal";
import { orgUrl } from "~/lib/utils";

const CANONICAL = new URL("/imprint/", orgUrl).toString();

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Imprint - AIP:Aero",
    description:
      "Legal notice (imprint) for AIP:Aero - provider, contact and VAT details. AIP:Aero is a project of Dross:Media.",
    canonical: CANONICAL,
  });
}

const rowLabel = "text-drossgray-dark text-sm";
const rowValue = "font-medium break-all";
const h2 = "text-xl font-semibold tracking-tight";

/** The contact e-mail is shown as text but links to the contact form. */
function ContactLink({ label }: { label: string }) {
  return (
    <ExternalLink
      href={IMPRINT.contactUrl}
      hrefTitle={`${label} - ${IMPRINT.brand}`}
      className="text-drossblue underline"
    >
      {IMPRINT.email}
    </ExternalLink>
  );
}

/** AIP:Aero is a project of Dross:Media - the brand links to the network. */
function brandLink(chunks: React.ReactNode) {
  return (
    <ExternalLink
      href={IMPRINT.brandUrl}
      hrefTitle={`${IMPRINT.brand} - Dross:Network`}
      className="text-drossblue underline"
    >
      {chunks}
    </ExternalLink>
  );
}

export default function ImprintPage() {
  return (
    <LegalShell
      title="Imprint"
      intro="Legal notice and provider identification for AIP:Aero."
      jsonLd={<LegalBreadcrumbJsonLd name="Imprint" url={CANONICAL} />}
    >
      {/* ---------- English ---------- */}
      <section>
        <SectionHeading className={h2} linkTitle="Imprint - Provider">
          Provider
        </SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
          <dt className={rowLabel}>Responsible</dt>
          <dd className={rowValue}>{IMPRINT.name}</dd>
          <dt className={rowLabel}>Address</dt>
          <dd className={rowValue}>
            Available on request and stated on invoices.
          </dd>
          <dt className={rowLabel}>Contact</dt>
          <dd className={rowValue}>
            <ContactLink label="Contact" />
          </dd>
          <dt className={rowLabel}>VAT ID</dt>
          <dd className={rowValue}>{IMPRINT.vatId}</dd>
          <dt className={rowLabel}>Tax number</dt>
          <dd className={rowValue}>{IMPRINT.taxNumber}</dd>
        </dl>
      </section>

      <section>
        <SectionHeading className={h2} linkTitle="Imprint - About">
          About
        </SectionHeading>
        <p className="mt-3">
          AIP:Aero is a project of {brandLink("Dross:Media")}.
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
          linkTitle="Imprint - Liability for content and links"
        >
          Liability for content and links
        </SectionHeading>
        <p className="mt-3">
          As a service provider we are responsible for our own content on these
          pages under the general laws. We are not obligated to monitor
          transmitted or stored third-party information. We accept no liability
          for the content of external links; their operators are solely
          responsible for those pages. On becoming aware of any legal violation
          we will remove the content in question without delay.
        </p>
        <SectionHeading
          as="h3"
          className="mt-5 font-medium"
          linkTitle="Liability - Copyright"
        >
          Copyright
        </SectionHeading>
        <p className="mt-2">
          Concepts and implementations on this site are copyright of
          Dross:Media. Content created by us is subject to copyright law; any
          reproduction, adaptation or distribution beyond the limits of
          copyright requires prior written consent.
        </p>
      </section>

      {/* ---------- Deutsch ---------- */}
      <section lang="de" className="border-drossgray-dark/15 border-t pt-8">
        <SectionHeading className={h2} linkTitle="Impressum - Anbieter">
          Anbieter
        </SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
          <dt className={rowLabel}>Verantwortlich</dt>
          <dd className={rowValue}>{IMPRINT.name}</dd>
          <dt className={rowLabel}>Anschrift</dt>
          <dd className={rowValue}>
            Auf Anfrage sowie auf Rechnungen enthalten.
          </dd>
          <dt className={rowLabel}>Kontakt</dt>
          <dd className={rowValue}>
            <ContactLink label="Kontakt" />
          </dd>
          <dt className={rowLabel}>USt-IdNr.</dt>
          <dd className={rowValue}>{IMPRINT.vatId}</dd>
          <dt className={rowLabel}>Steuernummer</dt>
          <dd className={rowValue}>{IMPRINT.taxNumber}</dd>
        </dl>

        <SectionHeading className={`${h2} mt-8`} linkTitle="Impressum - Über">
          Über
        </SectionHeading>
        <p className="mt-3">
          AIP:Aero ist ein Projekt von {brandLink("Dross:Media")}.
        </p>

        <SectionHeading
          className={`${h2} mt-8`}
          linkTitle="Impressum - Haftung für Inhalte und Links"
        >
          Haftung für Inhalte und Links
        </SectionHeading>
        <p className="mt-3">
          Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach
          den allgemeinen Gesetzen verantwortlich. Wir sind nicht verpflichtet,
          übermittelte oder gespeicherte fremde Informationen zu überwachen. Für
          die Inhalte externer Links übernehmen wir keine Haftung; für diese
          sind ausschließlich deren Betreiber verantwortlich. Bei Bekanntwerden
          von Rechtsverletzungen entfernen wir die betreffenden Inhalte
          umgehend.
        </p>
        <SectionHeading
          as="h3"
          className="mt-5 font-medium"
          linkTitle="Haftung - Urheberrecht"
        >
          Urheberrecht
        </SectionHeading>
        <p className="mt-2">
          Konzepte und Umsetzungen dieser Seite unterliegen dem Copyright von
          Dross:Media. Die von uns erstellten Inhalte unterliegen dem
          Urheberrecht; Vervielfältigung, Bearbeitung und Verbreitung außerhalb
          der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen
          Zustimmung.
        </p>
      </section>
    </LegalShell>
  );
}

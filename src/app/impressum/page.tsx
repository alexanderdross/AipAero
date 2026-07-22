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

const EN = new URL("/imprint/", orgUrl).toString();
const DE = new URL("/de/impressum/", orgUrl).toString();

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Impressum - AIP:Aero",
    description:
      "Impressum von AIP:Aero - Anbieter, Kontakt und Umsatzsteuer-ID. AIP:Aero ist ein Projekt von Dross:Media.",
    canonical: DE,
    lang: "de",
    enHref: EN,
    deHref: DE,
  });
}

const rowLabel = "text-drossgray-dark text-sm";
const rowValue = "font-medium break-all";
const h2 = "text-xl font-semibold tracking-tight";
const inlineLink = "text-drossblue underline";

export default function ImpressumPage() {
  return (
    <LegalShell
      lang="de"
      title="Impressum"
      intro="Impressum und Anbieterkennzeichnung für AIP:Aero."
      altLink={{
        href: "/imprint/",
        label: "English",
        hrefLang: "en",
        title: "Imprint - English version",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Impressum" url={DE} />}
    >
      <section>
        <SectionHeading className={h2} linkTitle="Impressum - Anbieter">
          Anbieter
        </SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
          <dt className={rowLabel}>Verantwortlich</dt>
          <dd className={rowValue}>
            <ExternalLink
              href={IMPRINT.personUrl}
              hrefTitle="Alexander Dross - Gründer von AIP:Aero und Dross:Media"
              className={inlineLink}
            >
              {IMPRINT.name}
            </ExternalLink>
          </dd>
          <dt className={rowLabel}>Anschrift</dt>
          <dd className={rowValue}>
            Auf Anfrage sowie auf Rechnungen enthalten.
          </dd>
          <dt className={rowLabel}>Kontakt</dt>
          <dd className={rowValue}>
            <a
              href={IMPRINT.contactPathDe}
              title={`Kontakt - ${IMPRINT.brand}`}
              className={inlineLink}
            >
              {IMPRINT.email}
            </a>
          </dd>
          <dt className={rowLabel}>USt-IdNr.</dt>
          <dd className={rowValue}>{IMPRINT.vatId}</dd>
          <dt className={rowLabel}>Steuernummer</dt>
          <dd className={rowValue}>{IMPRINT.taxNumber}</dd>
        </dl>
      </section>

      <section>
        <SectionHeading className={h2} linkTitle="Impressum - Über">
          Über
        </SectionHeading>
        <p className="mt-3">
          AIP:Aero ist ein Projekt von{" "}
          <ExternalLink
            href={IMPRINT.mediaUrl}
            hrefTitle="Dross:Media - digitale Projekte von Alexander Dross"
            className={inlineLink}
          >
            Dross:Media
          </ExternalLink>
          .
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
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

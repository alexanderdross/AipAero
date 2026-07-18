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
    title: "Imprint - AIP:Aero",
    description:
      "Legal notice (imprint) for AIP:Aero - provider, contact and VAT details. AIP:Aero is a project of Dross:Media.",
    canonical: EN,
    lang: "en",
    enHref: EN,
    deHref: DE,
  });
}

const rowLabel = "text-drossgray-dark text-sm";
const rowValue = "font-medium break-all";
const h2 = "text-xl font-semibold tracking-tight";
const inlineLink = "text-drossblue underline";

export default function ImprintPage() {
  return (
    <LegalShell
      lang="en"
      title="Imprint"
      intro="Legal notice and provider identification for AIP:Aero."
      altLink={{
        href: "/de/impressum/",
        label: "Deutsch",
        hrefLang: "de",
        title: "Impressum - deutsche Fassung",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Imprint" url={EN} />}
    >
      <section>
        <SectionHeading className={h2} linkTitle="Imprint - Provider">
          Provider
        </SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
          <dt className={rowLabel}>Responsible</dt>
          <dd className={rowValue}>
            <ExternalLink
              href={IMPRINT.personUrl}
              hrefTitle="Alexander Dross - founder of AIP:Aero and Dross:Media"
              className={inlineLink}
            >
              {IMPRINT.name}
            </ExternalLink>
          </dd>
          <dt className={rowLabel}>Address</dt>
          <dd className={rowValue}>
            Available on request and stated on invoices.
          </dd>
          <dt className={rowLabel}>Contact</dt>
          <dd className={rowValue}>
            <ExternalLink
              href={IMPRINT.contactUrl}
              hrefTitle={`Contact - ${IMPRINT.brand}`}
              className={inlineLink}
            >
              {IMPRINT.email}
            </ExternalLink>
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
          AIP:Aero is a project of{" "}
          <ExternalLink
            href={IMPRINT.mediaUrl}
            hrefTitle="Dross:Media - digital projects by Alexander Dross"
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
    </LegalShell>
  );
}

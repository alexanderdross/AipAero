import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import {
  LegalBreadcrumbJsonLd,
  LegalShell,
  legalMetadata,
} from "~/components/legal-shell";
import { SectionHeading } from "~/components/section-heading";
import { AIP_SOURCES, DATA_SOURCES } from "~/lib/legal";
import { orgUrl } from "~/lib/utils";

const EN = new URL("/terms/", orgUrl).toString();
const DE = new URL("/agb/", orgUrl).toString();

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Terms of Service - AIP:Aero",
    description:
      "Terms of service of AIP:Aero, the free AIP and approach chart search for Europe: service description, disclaimer of liability and data sources.",
    canonical: EN,
    lang: "en",
    enHref: EN,
    deHref: DE,
  });
}

const h2 = "text-xl font-semibold tracking-tight";
const h3 = "mt-5 font-medium";
const listItem = "text-drossgray-dark break-all";

export default function TermsPage() {
  return (
    <LegalShell
      lang="en"
      title="Terms of Service"
      intro="AIP:Aero is a free search and index service for Aeronautical Information Publications (AIP), approach charts and airport data across Europe."
      altLink={{
        href: "/agb/",
        label: "Deutsch",
        hrefLang: "de",
        title: "Nutzungsbedingungen - deutsche Fassung",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Terms of Service" url={EN} />}
    >
      <section>
        <SectionHeading
          className={h2}
          linkTitle="Terms of Service - Our service"
        >
          Our service
        </SectionHeading>
        <p className="mt-3">
          <Link
            href="/"
            title="AIP:Aero Home"
            className="text-drossblue underline"
          >
            AIP:Aero
          </Link>{" "}
          lets you find aerodromes by name or ICAO code and takes you directly
          to the official AIP publication of the respective country. In
          addition, our airport pages embed supplementary information such as
          weather reports (METAR/TAF), aerodrome data (runways, frequencies,
          elevation), maps and contact details, and pages can be saved for
          offline use. The service is provided free of charge and without
          registration.
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
          linkTitle="Terms of Service - Disclaimer of liability"
        >
          Disclaimer of liability
        </SectionHeading>
        <p className="mt-3">
          AIP:Aero cannot be held liable under any circumstances. We do not
          publish aeronautical documents ourselves: we only link to the latest
          Aeronautical Information Publication (AIP) made available by the
          official provider of the respective country. The same applies to
          weather data (METAR/TAF) and airport data: we embed this information
          on our pages, but it originates from the external sources listed
          below. We assume no liability or warranty for the accuracy,
          completeness or timeliness of any linked or embedded content, nor for
          the availability of this website. This website does not replace the
          official pre-flight briefing: the pilot in command remains solely
          responsible for obtaining and verifying all information required for a
          flight.
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
          linkTitle="Terms of Service - Data sources"
        >
          Data sources
        </SectionHeading>
        <p className="mt-3">
          We obtain the linked and embedded data from the following sources
          (addresses shown as plain text, deliberately not clickable).
        </p>

        <SectionHeading
          as="h3"
          className={h3}
          linkTitle="Data sources - Official AIP publications"
        >
          Official AIP publications we link to
        </SectionHeading>
        <ul className="mt-2 flex flex-col gap-y-1 text-sm">
          {AIP_SOURCES.map((s) => (
            <li key={s.url}>
              {s.name}
              {" - "}
              <span className={listItem}>{s.url}</span>
            </li>
          ))}
        </ul>

        <SectionHeading
          as="h3"
          className={h3}
          linkTitle="Data sources - Embedded external data"
        >
          Embedded external data
        </SectionHeading>
        <ul className="mt-2 flex flex-col gap-y-1 text-sm">
          {DATA_SOURCES.map((s) => (
            <li key={s.url}>
              {s.name} ({s.en}){" - "}
              <span className={listItem}>{s.url}</span>
            </li>
          ))}
        </ul>
      </section>
    </LegalShell>
  );
}

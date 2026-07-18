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
    title: "Nutzungsbedingungen - AIP:Aero",
    description:
      "Nutzungsbedingungen von AIP:Aero, der kostenlosen AIP- und Anflugkarten-Suche für Europa: Servicebeschreibung, Haftungsausschluss und Datenquellen.",
    canonical: DE,
    lang: "de",
    enHref: EN,
    deHref: DE,
  });
}

const h2 = "text-xl font-semibold tracking-tight";
const h3 = "mt-5 font-medium";
const listItem = "text-drossgray-dark break-all";

export default function AgbPage() {
  return (
    <LegalShell
      lang="de"
      title="Nutzungsbedingungen"
      intro="AIP:Aero ist ein kostenloser Such- und Indexdienst für Luftfahrthandbücher (AIP), Anflugkarten und Flugplatzdaten in Europa."
      altLink={{
        href: "/terms/",
        label: "English",
        hrefLang: "en",
        title: "Terms of Service - English version",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Nutzungsbedingungen" url={DE} />}
    >
      <section>
        <SectionHeading
          className={h2}
          linkTitle="Nutzungsbedingungen - Unser Service"
        >
          Unser Service
        </SectionHeading>
        <p className="mt-3">
          <Link
            href="/"
            title="AIP:Aero Startseite"
            className="text-drossblue underline"
          >
            AIP:Aero
          </Link>{" "}
          findet Flugplätze per Name oder ICAO-Code und führt direkt zur
          offiziellen AIP-Publikation des jeweiligen Landes. Ergänzend betten
          unsere Flugplatzseiten Zusatzinformationen ein, etwa Wettermeldungen
          (METAR/TAF), Flugplatzdaten (Pisten, Frequenzen, Höhe), Karten und
          Kontaktdaten; Seiten lassen sich zudem für die Offline-Nutzung
          speichern. Der Dienst ist kostenlos und ohne Registrierung nutzbar.
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
          linkTitle="Nutzungsbedingungen - Haftungsausschluss"
        >
          Haftungsausschluss
        </SectionHeading>
        <p className="mt-3">
          AIP:Aero kann unter keinen Umständen haftbar gemacht werden. Wir
          veröffentlichen selbst keine Luftfahrtdokumente, sondern verlinken
          lediglich auf die jeweils neueste, vom offiziellen Herausgeber des
          jeweiligen Landes bereitgestellte AIP (Aeronautical Information
          Publication). Gleiches gilt für Wetterdaten (METAR/TAF) und
          Flugplatzdaten: Diese Informationen binden wir zwar auf unseren Seiten
          ein, sie stammen jedoch von den unten aufgeführten externen Quellen.
          Für Richtigkeit, Vollständigkeit und Aktualität verlinkter oder
          eingebundener Inhalte sowie für die Verfügbarkeit dieser Website
          übernehmen wir keinerlei Haftung oder Gewähr. Diese Website ersetzt
          keine offizielle Flugvorbereitung: Der verantwortliche
          Luftfahrzeugführer bleibt allein verpflichtet, alle für einen Flug
          erforderlichen Informationen einzuholen und zu prüfen.
        </p>
      </section>

      <section>
        <SectionHeading
          className={h2}
          linkTitle="Nutzungsbedingungen - Datenquellen"
        >
          Datenquellen
        </SectionHeading>
        <p className="mt-3">
          Die verlinkten und eingebundenen Daten beziehen wir aus folgenden
          Quellen (Adressen als reiner Text, bewusst nicht klickbar).
        </p>

        <SectionHeading
          as="h3"
          className={h3}
          linkTitle="Datenquellen - Offizielle AIP-Publikationen"
        >
          Offizielle AIP-Publikationen, auf die wir verlinken
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
          linkTitle="Datenquellen - Eingebundene externe Daten"
        >
          Eingebundene externe Daten
        </SectionHeading>
        <ul className="mt-2 flex flex-col gap-y-1 text-sm">
          {DATA_SOURCES.map((s) => (
            <li key={s.url}>
              {s.name} ({s.de}){" - "}
              <span className={listItem}>{s.url}</span>
            </li>
          ))}
        </ul>
      </section>
    </LegalShell>
  );
}

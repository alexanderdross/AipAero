import type { Metadata } from "next";
import Link from "next/link";
import { LegalBreadcrumbJsonLd, LegalShell } from "~/components/legal-shell";
import { SectionHeading } from "~/components/section-heading";
import { orgUrl, serpTitle } from "~/lib/utils";

const CANONICAL = new URL("/terms/", orgUrl).toString();

export const metadata: Metadata = {
  title: serpTitle("Terms of Service - AIP:Aero"),
  description:
    "Terms of service of AIP:Aero, the free AIP and approach chart search for Europe: service description, disclaimer of liability and data sources.",
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, siteName: "Terms of Service - AIP:Aero" },
};

// The AIP providers are language-independent data, so they live in code (only
// the section headings / descriptors are translated). Addresses render as PLAIN
// TEXT on purpose - deliberately not clickable.
// KEEP THIS IN SYNC WITH `liveCountries` (src/lib/utils.ts): every launched
// country's official AIP provider must be listed here (attribution). `cc` = the
// liveCountries code; scripts/check-live-countries-coverage.mjs asserts every
// live country is attributed here (BE covers BE+LU, one row). Order follows
// onboarding order.
const AIP_SOURCES: { cc: string; name: string; url: string }[] = [
  {
    cc: "at",
    name: "Austro Control (Österreich)",
    url: "https://eaip.austrocontrol.at",
  },
  {
    cc: "be",
    name: "skeyes (Belgium & Luxembourg)",
    url: "https://ops.skeyes.be",
  },
  { cc: "cz", name: "ANS CR (Česko)", url: "https://aim.rlp.cz" },
  { cc: "dk", name: "Naviair (Danmark)", url: "https://aim.naviair.dk" },
  {
    cc: "de",
    name: "DFS Deutsche Flugsicherung (Deutschland)",
    url: "https://aip.dfs.de",
  },
  {
    cc: "fr",
    name: "SIA - Service de l'Information Aéronautique (France)",
    url: "https://www.sia.aviation-civile.gouv.fr",
  },
  { cc: "gr", name: "HASP (Ελλάδα)", url: "https://aisgr.hasp.gov.gr" },
  { cc: "nl", name: "LVNL (Nederland)", url: "https://eaip.lvnl.nl" },
  { cc: "no", name: "Avinor (Norge)", url: "https://aim-prod.avinor.no" },
  { cc: "pl", name: "PANSA (Polska)", url: "https://www.ais.pansa.pl" },
  { cc: "se", name: "LFV (Sverige)", url: "https://aro.lfv.se" },
  {
    cc: "uk",
    name: "NATS (United Kingdom)",
    url: "https://nats-uk.ead-it.com",
  },
  { cc: "ee", name: "EANS (Eesti)", url: "https://eaip.eans.ee" },
  { cc: "fi", name: "Fintraffic ANS (Suomi)", url: "https://www.ais.fi" },
  { cc: "es", name: "ENAIRE (España)", url: "https://aip.enaire.es" },
  { cc: "lv", name: "LGS (Latvija)", url: "https://ais.lgs.lv" },
  { cc: "is", name: "Isavia (Ísland)", url: "https://eaip.isavia.is" },
  { cc: "pt", name: "NAV Portugal (Portugal)", url: "https://ais.nav.pt" },
  {
    cc: "hu",
    name: "HungaroControl (Magyarország)",
    url: "https://ais.hungarocontrol.hu",
  },
  {
    cc: "si",
    name: "Slovenia Control (Slovenija)",
    url: "https://aim.sloveniacontrol.si",
  },
  { cc: "lt", name: "Oro navigacija (Lietuva)", url: "https://www.ans.lt" },
  { cc: "rs", name: "SMATSA (Srbija)", url: "https://smatsa.rs" },
  { cc: "ie", name: "AirNav Ireland (Ireland)", url: "https://www.airnav.ie" },
  { cc: "sk", name: "LPS SR (Slovensko)", url: "https://aim.lps.sk" },
  {
    cc: "ba",
    name: "BHANSA (Bosna i Hercegovina)",
    url: "https://eaip.bhansa.gov.ba",
  },
  {
    cc: "ch",
    name: "skybriefing / skyguide (Schweiz)",
    url: "https://www.skybriefing.com",
  },
  { cc: "al", name: "Albcontrol (Shqipëri)", url: "https://www.albcontrol.al" },
  {
    cc: "mk",
    name: "M-NAV (Severna Makedonija)",
    url: "https://ais.m-nav.info",
  },
  { cc: "ro", name: "AISRO / ROMATSA (România)", url: "https://www.aisro.ro" },
  {
    cc: "cy",
    name: "DCA Cyprus (Κύπρος)",
    url: "http://vfrmanual.dca.mcw.gov.cy",
  },
  {
    cc: "mt",
    name: "MATS / Transport Malta (Malta)",
    url: "https://www.transport.gov.mt",
  },
  { cc: "md", name: "MOLDATSA (Moldova)", url: "https://aim.moldatsa.md" },
  { cc: "it", name: "ENAV (Italia)", url: "https://www.enav.it" },
  {
    cc: "hr",
    name: "Croatia Control (Hrvatska)",
    url: "https://www.crocontrol.hr",
  },
  { cc: "bg", name: "BULATSA (България)", url: "https://www.bulatsa.com" },
  { cc: "tr", name: "DHMI (Türkiye)", url: "https://dhmi.gov.tr" },
  {
    cc: "ge",
    name: "Sakaeronavigatsia (საქართველო)",
    url: "https://airnav.ge",
  },
  { cc: "am", name: "ARMATS (Հայաստան)", url: "https://armats.am" },
  {
    cc: "az",
    name: "AZANS / State Civil Aviation Agency (Azərbaycan)",
    url: "https://www.caa.gov.az",
  },
  { cc: "ua", name: "UkSATSE (Україна)", url: "https://www.aisukraine.net" },
  {
    cc: "uz",
    name: "Uzaeronavigation (Oʻzbekiston)",
    url: "https://uzaeronavigation.com",
  },
  {
    cc: "by",
    name: "Belaeronavigatsia (Беларусь)",
    url: "https://www.ban.by",
  },
  {
    cc: "kz",
    name: "Kazaeronavigatsia (Қазақстан)",
    url: "https://www.ans.kz",
  },
  { cc: "xk", name: "ASHNA / CAA Kosovo (Kosova)", url: "https://kans-ks.org" },
  { cc: "ru", name: "CAICA (Россия)", url: "https://www.caica.ru" },
  {
    cc: "tj",
    name: "Tajikairnavigation (Тоҷикистон)",
    url: "https://www.caica.ru/aiptjk",
  },
  {
    cc: "tm",
    name: "Turkmenhowayollary (Türkmenistan)",
    url: "https://www.caica.ru/aiptkm",
  },
  {
    cc: "kg",
    name: "Kyrgyzaeronavigatsia (Кыргызстан)",
    url: "https://ansp.kg",
  },
];

// Embedded external data sources - descriptors translated inline (en / de).
const DATA_SOURCES: {
  name: string;
  url: string;
  en: string;
  de: string;
}[] = [
  {
    name: "NOAA / Aviation Weather Center",
    url: "https://aviationweather.gov",
    en: "weather METAR/TAF and airport data",
    de: "Wetter METAR/TAF und Flugplatzdaten",
  },
  {
    name: "OurAirports",
    url: "https://ourairports.com",
    en: "airport base data",
    de: "Flugplatz-Basisdaten",
  },
  {
    name: "OpenAIP",
    url: "https://www.openaip.net",
    en: "extended aerodrome data: runways, frequencies, fuel",
    de: "erweiterte Flugplatzdaten: Pisten, Frequenzen, Kraftstoff",
  },
  {
    name: "OpenStreetMap / Nominatim",
    url: "https://www.openstreetmap.org",
    en: "maps and addresses",
    de: "Karten und Adressen",
  },
];

const h2 = "text-xl font-semibold tracking-tight";
const h3 = "mt-5 font-medium";
const listItem = "text-drossgray-dark break-all";

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="AIP:Aero is a free search and index service for Aeronautical Information Publications (AIP), approach charts and airport data across Europe."
      jsonLd={<LegalBreadcrumbJsonLd name="Terms of Service" url={CANONICAL} />}
    >
      {/* ---------- English ---------- */}
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

      {/* ---------- Deutsch ---------- */}
      <section lang="de" className="border-drossgray-dark/15 border-t pt-8">
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

        <SectionHeading
          className={`${h2} mt-8`}
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

      {/* ---------- Data sources (language-independent list) ---------- */}
      <section className="border-drossgray-dark/15 border-t pt-8">
        <SectionHeading
          className={h2}
          linkTitle="Terms of Service - Data sources"
        >
          Data sources / Datenquellen
        </SectionHeading>
        <p className="mt-3">
          We obtain the linked and embedded data from the following sources
          (addresses shown as plain text, deliberately not clickable).
        </p>
        <p className="mt-1" lang="de">
          Die verlinkten und eingebundenen Daten beziehen wir aus folgenden
          Quellen (Adressen als reiner Text, bewusst nicht klickbar).
        </p>

        <SectionHeading
          as="h3"
          className={h3}
          linkTitle="Data sources - Official AIP publications"
        >
          Official AIP publications / Offizielle AIP-Publikationen
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
          Embedded external data / Eingebundene externe Daten
        </SectionHeading>
        <ul className="mt-2 flex flex-col gap-y-1 text-sm">
          {DATA_SOURCES.map((s) => (
            <li key={s.url}>
              {s.name} ({s.en} <span lang="de">/ {s.de}</span>){" - "}
              <span className={listItem}>{s.url}</span>
            </li>
          ))}
        </ul>
      </section>
    </LegalShell>
  );
}

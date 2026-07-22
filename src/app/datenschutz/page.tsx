import type { Metadata, ResolvingMetadata } from "next";
import { ExternalLink } from "~/components/external-link";
import {
  LegalBreadcrumbJsonLd,
  LegalShell,
  legalMetadata,
} from "~/components/legal-shell";
import { SectionHeading } from "~/components/section-heading";
import { IMPRINT, PRIVACY_LINKS } from "~/lib/legal";
import { orgUrl } from "~/lib/utils";

const EN = new URL("/privacy/", orgUrl).toString();
const DE = new URL("/de/datenschutz/", orgUrl).toString();

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Datenschutzerklärung - AIP:Aero",
    description:
      "Wie AIP:Aero mit Daten umgeht: Cloudflare-Hosting, Google AdSense, lokale Speicherung für Favoriten - keine Accounts, kein Analytics, keine Tracking-Pixel.",
    canonical: DE,
    lang: "de",
    enHref: EN,
    deHref: DE,
  });
}

const h2 = "text-xl font-semibold tracking-tight";

/** A permanently-underlined external link (axe link-in-text-block). */
function ext(href: string, hrefTitle: string, children: React.ReactNode) {
  return (
    <ExternalLink
      href={href}
      hrefTitle={hrefTitle}
      className="text-drossblue underline"
    >
      {children}
    </ExternalLink>
  );
}

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Verantwortlicher",
    body: (
      <>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist{" "}
        {ext(
          IMPRINT.personUrl,
          "Alexander Dross - Gründer von AIP:Aero und Dross:Media",
          IMPRINT.name,
        )}{" "}
        (
        {ext(
          IMPRINT.mediaUrl,
          "Dross:Media - digitale Projekte von Alexander Dross",
          "Dross:Media",
        )}
        ). Kontaktmöglichkeiten findest du auf unserer{" "}
        <a
          href={IMPRINT.contactPathDe}
          title={`Kontakt - ${IMPRINT.brand}`}
          className="text-drossblue underline"
        >
          Kontaktseite
        </a>{" "}
        sowie im Impressum.
      </>
    ),
  },
  {
    title: "Hosting und Server-Logs",
    body: (
      <>
        Diese Website wird auf Cloudflare Workers gehostet. Beim Aufruf
        verarbeitet Cloudflare technische Verbindungsdaten (z. B. deine
        IP-Adresse), um die Seiten auszuliefern und Sicherheit und Stabilität zu
        gewährleisten. Der Quellcode wird über GitHub bereitgestellt. Siehe die{" "}
        {ext(
          PRIVACY_LINKS.cloudflare,
          "Cloudflare Privacy Policy",
          "Cloudflare-Datenschutzerklärung",
        )}
        .
      </>
    ),
  },
  {
    title: "Werbung (Google AdSense)",
    body: (
      <>
        Wir nutzen Google AdSense zur Anzeige von Werbung. Google kann Cookies
        setzen und Nutzungsdaten verarbeiten, um Anzeigen auszuspielen -
        einschließlich personalisierter Werbung, soweit zulässig. Deine
        Einstellungen kannst du in den{" "}
        {ext(
          PRIVACY_LINKS.googleAdsSettings,
          "Google Ad Settings",
          "Google-Anzeigeneinstellungen",
        )}{" "}
        verwalten; Details in der{" "}
        {ext(
          PRIVACY_LINKS.google,
          "Google Privacy Policy",
          "Google-Datenschutzerklärung",
        )}
        .
      </>
    ),
  },
  {
    title: "Search Console",
    body: "Wir nutzen die Google Search Console, um zu verstehen, wie die Seite in der Google-Suche abschneidet. Sie liefert uns aggregierte Statistiken und identifiziert keine einzelnen Besucher.",
  },
  {
    title: "Lokale Speicherung (Favoriten und Offline)",
    body: "Deine gespeicherten Flugplätze, Favoriten und offline gespeicherten Seiten werden lokal in deinem Browser abgelegt (localStorage und Browser-Cache). Diese Daten bleiben auf deinem Gerät und werden nicht an uns übertragen.",
  },
  {
    title: "Karten",
    body: (
      <>
        Die Flugplatzkarte lädt Kartenkacheln von OpenStreetMap erst, nachdem du
        mit der Karte interagierst. Zur Auslieferung der Kacheln wird deine
        IP-Adresse an die Kachel-Server übermittelt. Siehe die{" "}
        {ext(
          PRIVACY_LINKS.osm,
          "OpenStreetMap Foundation privacy policy",
          "Datenschutzerklärung der OpenStreetMap Foundation",
        )}
        .
      </>
    ),
  },
  {
    title: "Luftfahrtdaten und Wetter",
    body: "Flugplatzdaten und Wetter (METAR/TAF) sowie Adressabfragen werden von unserem Server aus Drittquellen wie dem Aviation Weather Center (NOAA), OpenAIP und OpenStreetMap/Nominatim abgerufen. Diese Abfragen erfolgen durch unseren Server, nicht durch deinen Browser - deine personenbezogenen Daten werden dabei nicht an diese Dienste weitergegeben.",
  },
  {
    title: "Standort (Locate me)",
    body: "Die optionale Schaltfläche 'Locate me' der Karte nutzt die Geolokalisierung deines Browsers erst nach dem Antippen, um die Karte auf deine Position zu zentrieren. Dein Standort wird nur im Browser verwendet und weder gespeichert noch an uns übertragen.",
  },
  {
    title: "Deine Rechte",
    body: "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch bezüglich deiner personenbezogenen Daten sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde. Da wir keine Nutzerkonten führen und keine Profile speichern, sind die verarbeiteten Daten minimal. Zur Ausübung deiner Rechte nutze bitte die Kontaktangaben im Impressum.",
  },
  {
    title: "Weitere Informationen",
    body: (
      <>
        Für netzwerkweite Details über diese Website hinaus siehe die
        vollständige{" "}
        {ext(
          PRIVACY_LINKS.fullPolicy,
          "Privacy policy - Dross:Network",
          "Datenschutzerklärung des Dross:Network",
        )}
        .
      </>
    ),
  },
];

export default function DatenschutzPage() {
  return (
    <LegalShell
      lang="de"
      title="Datenschutzerklärung"
      intro="Welche Daten AIP:Aero verarbeitet - und welche nicht. Keine Accounts, kein Analytics, keine Social Plugins."
      altLink={{
        href: "/privacy/",
        label: "English",
        hrefLang: "en",
        title: "Privacy Policy - English version",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Datenschutzerklärung" url={DE} />}
    >
      {sections.map((s) => (
        <section key={s.title}>
          <SectionHeading
            className={h2}
            linkTitle={`Datenschutzerklärung - ${s.title}`}
          >
            {s.title}
          </SectionHeading>
          <p className="mt-3">{s.body}</p>
        </section>
      ))}
    </LegalShell>
  );
}

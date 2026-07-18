import type { Metadata } from "next";
import { ExternalLink } from "~/components/external-link";
import { LegalBreadcrumbJsonLd, LegalShell } from "~/components/legal-shell";
import { SectionHeading } from "~/components/section-heading";
import { IMPRINT, PRIVACY_LINKS } from "~/lib/legal";
import { orgUrl, serpTitle } from "~/lib/utils";

const CANONICAL = new URL("/privacy/", orgUrl).toString();

export const metadata: Metadata = {
  title: serpTitle("Privacy Policy - AIP:Aero"),
  description:
    "How AIP:Aero handles data: Cloudflare hosting, Google AdSense, local storage for favorites - no accounts, no analytics, no tracking pixels.",
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, siteName: "Privacy Policy - AIP:Aero" },
};

const h2 = "text-xl font-semibold tracking-tight";

/**
 * A permanently-underlined external link (axe link-in-text-block). Plain helper
 * called as `ext(...)` - not a curried component factory (which would trip
 * react/display-name).
 */
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

const contactTitle = `Contact - ${IMPRINT.brand}`;

type S = { title: string; body: React.ReactNode };

const EN: S[] = [
  {
    title: "Controller",
    body: (
      <>
        The controller responsible for data processing on this website is{" "}
        {IMPRINT.name} (Dross:Media). For contact details please see our{" "}
        {ext(IMPRINT.contactUrl, contactTitle, "contact page")} and our imprint.
      </>
    ),
  },
  {
    title: "Hosting and server logs",
    body: (
      <>
        This website is hosted on Cloudflare Workers. When you access the site,
        Cloudflare processes technical connection data (such as your IP address)
        to deliver the pages and to ensure security and stability. The source
        code is deployed via GitHub. See the{" "}
        {ext(
          PRIVACY_LINKS.cloudflare,
          "Cloudflare Privacy Policy",
          "Cloudflare Privacy Policy",
        )}
        .
      </>
    ),
  },
  {
    title: "Advertising (Google AdSense)",
    body: (
      <>
        We use Google AdSense to display advertising. Google may set cookies and
        process usage data to show ads, including personalized advertising where
        permitted. You can manage your preferences in{" "}
        {ext(
          PRIVACY_LINKS.googleAdsSettings,
          "Google Ad Settings",
          "Google Ad Settings",
        )}
        ; details are in the{" "}
        {ext(
          PRIVACY_LINKS.google,
          "Google Privacy Policy",
          "Google Privacy Policy",
        )}
        .
      </>
    ),
  },
  {
    title: "Search Console",
    body: "We use Google Search Console to understand how the site performs in Google Search. It provides us with aggregated statistics and does not identify individual visitors.",
  },
  {
    title: "Local storage (favorites and offline)",
    body: "Your saved airports, favorites and offline-saved pages are stored locally in your browser (localStorage and the browser cache). This data stays on your device and is not transmitted to us.",
  },
  {
    title: "Maps",
    body: (
      <>
        The airport map loads map tiles from OpenStreetMap only after you
        interact with the map. Your IP address is transmitted to the tile
        servers to deliver the tiles. See the{" "}
        {ext(
          PRIVACY_LINKS.osm,
          "OpenStreetMap Foundation privacy policy",
          "OpenStreetMap Foundation privacy policy",
        )}
        .
      </>
    ),
  },
  {
    title: "Aeronautical data and weather",
    body: "Aerodrome data and weather (METAR/TAF), as well as address lookups, are fetched by our server from third-party sources such as the Aviation Weather Center (NOAA), OpenAIP and OpenStreetMap/Nominatim. These requests are made by our server, not by your browser, so your personal data is not shared with them.",
  },
  {
    title: "Location (locate me)",
    body: "The map's optional 'locate me' button uses your browser's geolocation only after you tap it, to center the map on your position. Your location is used in the browser and is neither stored nor transmitted to us.",
  },
  {
    title: "Your rights",
    body: "You have the right to access, rectification, erasure, restriction and objection regarding your personal data, and the right to lodge a complaint with a supervisory authority. As we run no user accounts and store no personal profiles, the data we process is minimal. To exercise your rights, please use the contact details in our imprint.",
  },
  {
    title: "More information",
    body: (
      <>
        For network-wide details beyond this website, see the full{" "}
        {ext(
          PRIVACY_LINKS.fullPolicy,
          "Privacy policy - Dross:Network",
          "Dross:Network privacy policy",
        )}
        .
      </>
    ),
  },
];

const DE: S[] = [
  {
    title: "Verantwortlicher",
    body: (
      <>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist{" "}
        {IMPRINT.name} (Dross:Media). Kontaktmöglichkeiten findest du auf
        unserer {ext(IMPRINT.contactUrl, contactTitle, "Kontaktseite")} sowie im
        Impressum.
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

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="What data AIP:Aero processes, and what it does not. No accounts, no analytics, no social plugins."
      jsonLd={<LegalBreadcrumbJsonLd name="Privacy Policy" url={CANONICAL} />}
    >
      {/* ---------- English ---------- */}
      {EN.map((s) => (
        <section key={s.title}>
          <SectionHeading
            className={h2}
            linkTitle={`Privacy Policy - ${s.title}`}
          >
            {s.title}
          </SectionHeading>
          <p className="mt-3">{s.body}</p>
        </section>
      ))}

      {/* ---------- Deutsch ---------- */}
      <div
        lang="de"
        className="border-drossgray-dark/15 flex flex-col gap-8 border-t pt-8"
      >
        {DE.map((s) => (
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
      </div>
    </LegalShell>
  );
}

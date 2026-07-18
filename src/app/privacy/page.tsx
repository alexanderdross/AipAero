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
const DE = new URL("/datenschutz/", orgUrl).toString();

export function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return legalMetadata(parent, {
    title: "Privacy Policy - AIP:Aero",
    description:
      "How AIP:Aero handles data: Cloudflare hosting, Google AdSense, local storage for favorites - no accounts, no analytics, no tracking pixels.",
    canonical: EN,
    lang: "en",
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
    title: "Controller",
    body: (
      <>
        The controller responsible for data processing on this website is{" "}
        {IMPRINT.name} (Dross:Media). For contact details please see our{" "}
        {ext(IMPRINT.contactUrl, `Contact - ${IMPRINT.brand}`, "contact page")}{" "}
        and our imprint.
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

export default function PrivacyPage() {
  return (
    <LegalShell
      lang="en"
      title="Privacy Policy"
      intro="What data AIP:Aero processes, and what it does not. No accounts, no analytics, no social plugins."
      altLink={{
        href: "/datenschutz/",
        label: "Deutsch",
        hrefLang: "de",
        title: "Datenschutzerklärung - deutsche Fassung",
      }}
      jsonLd={<LegalBreadcrumbJsonLd name="Privacy Policy" url={EN} />}
    >
      {sections.map((s) => (
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
    </LegalShell>
  );
}

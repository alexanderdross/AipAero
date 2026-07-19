import {
  BadgeCheckIcon,
  GlobeIcon,
  MonitorSmartphoneIcon,
  ShieldCheckIcon,
} from "lucide-react";

/**
 * Small trust strip for the global landing page. Server-rendered and English
 * only (the root page pins the `uk` locale and carries no per-locale message
 * file), so the copy is hardcoded here and adds no new i18n keys. Palette-only,
 * no imagery - just four Lucide glyphs. The EFB tile doubles as the homepage's
 * link into the EFB guide (its body is wrapped in the anchor).
 */
const items = [
  {
    Icon: BadgeCheckIcon,
    title: "Free to use",
    text: "Open library of AIP and approach charts, no account needed",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Official sources",
    text: "We link straight to the latest version of each country's national AIP publication",
  },
  {
    Icon: GlobeIcon,
    title: "Across Europe",
    text: "VFR, IFR and heliport charts - plus weather, runways, fuel and opening hours - for a growing list of countries",
  },
  {
    Icon: MonitorSmartphoneIcon,
    title: "EFB & offline ready",
    // The whole tile is the anchor; the styled span makes the link visually
    // obvious (owner feedback) without nesting a second <a>.
    text: (
      <>
        <span className="text-drossblue underline">Install as an app</span>,
        save whole countries offline and import charts into your EFB - for free
      </>
    ),
    // English guide (the root page is English); per-locale EFB links live in
    // the footer of every locale page.
    href: "/uk/efb/",
    hrefTitle: "AIP:Aero on your EFB - install, offline charts, import",
  },
];

export function ValueProps() {
  return (
    <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ Icon, title, text, href, hrefTitle }) => {
          const body = (
            <>
              <Icon className="text-drossblue size-7" aria-hidden="true" />
              <h2 className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              <p className="text-drossgray-dark text-sm">{text}</p>
            </>
          );
          return (
            <li
              key={title}
              className="border-drossgray-dark/15 rounded-xl border bg-white text-center shadow-sm"
            >
              {href ? (
                <a
                  href={href}
                  title={hrefTitle}
                  className="hover:border-drossblue/40 flex h-full flex-col items-center gap-2 rounded-xl border border-transparent p-6 transition-colors"
                >
                  {body}
                </a>
              ) : (
                <div className="flex h-full flex-col items-center gap-2 p-6">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

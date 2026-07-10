import { BadgeCheckIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react";

/**
 * Small trust strip for the global landing page. Server-rendered and English
 * only (the root page pins the `uk` locale and carries no per-locale message
 * file), so the copy is hardcoded here and adds no new i18n keys. Palette-only,
 * no imagery - just three Lucide glyphs.
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
    text: "We link straight to each country's national AIP publication",
  },
  {
    Icon: GlobeIcon,
    title: "Across Europe",
    text: "VFR, IFR and heliport charts for a growing list of countries",
  },
];

export function ValueProps() {
  return (
    <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="border-drossgray-dark/15 flex flex-col items-center gap-2 rounded-xl border bg-white p-6 text-center shadow-sm"
          >
            <Icon className="text-drossblue size-7" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="text-drossgray-dark text-sm">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

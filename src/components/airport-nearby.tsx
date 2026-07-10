import { LinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SectionHeading } from "~/components/section-heading";
import { getPathname } from "~/i18n/routing";
import { haversineKm } from "~/lib/distance";
import { i18nPathMapping } from "~/lib/utils";
import { QUERIES } from "~/server/db/queries";

const MAX_KM = 100;
const MAX_ITEMS = 4;

/**
 * Server-rendered "nearby airfields" box: the closest chart-linked fields of the
 * same country to the current one, by great-circle distance. Needs coordinates
 * (from `airport_facts`), so it only appears once the OurAirports importer has
 * run / an OpenAIP key is set - and renders nothing otherwise. Deduplicated by
 * slug (a field listed under several categories appears once). Links open the
 * detail page, mirroring the list/map links.
 */
export async function AirportNearby({
  slug,
  lat,
  lon,
  country,
  locale,
}: {
  slug: string;
  lat: number | null;
  lon: number | null;
  country: string;
  locale: string;
}) {
  if (lat == null || lon == null) return null;
  const t = await getTranslations("Common");

  const all = await QUERIES.airportsWithCoords(country);
  const seen = new Set<string>();
  const nearby = all
    .filter((a) => a.slug !== slug && a.lat != null && a.lon != null)
    .map((a) => ({ ...a, dist: haversineKm(lat, lon, a.lat!, a.lon!) }))
    .filter((a) => a.dist <= MAX_KM)
    .sort((a, b) => a.dist - b.dist)
    .filter((a) => {
      if (seen.has(a.slug)) return false;
      seen.add(a.slug);
      return true;
    })
    .slice(0, MAX_ITEMS);

  if (!nearby.length) return null;

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading className="text-center text-xl font-normal">
        {t("nearby")}
      </SectionHeading>
      <ul className="mx-auto mt-3 flex w-fit flex-col gap-y-1 text-sm">
        {nearby.map((a) => {
          const href =
            getPathname({ href: i18nPathMapping[a.type], locale }) +
            `?${a.slug}`;
          return (
            <li
              key={a.slug}
              className="flex items-center justify-between gap-x-3"
            >
              <Link
                href={href}
                className="text-drossblue inline-flex items-center gap-x-2 hover:underline"
                target="_blank"
                rel="noopener"
              >
                <LinkIcon
                  className="h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{a.title}</span>
              </Link>
              <span className="text-drossgray-dark whitespace-nowrap">
                {Math.round(a.dist)} km
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

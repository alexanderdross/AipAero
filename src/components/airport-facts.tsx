import { getTranslations } from "next-intl/server";
import { getAirportFacts } from "~/lib/airport-facts";

/**
 * Server-rendered aerodrome-facts card (runways, frequencies, elevation),
 * embedded on the airport detail page. Data is merged from the OurAirports base
 * (D1) and OpenAIP (when a key is set) - see `~/lib/airport-facts`. Renders
 * nothing when no facts are available, so it stays quiet until the importer has
 * run / a key is configured.
 */
export async function AirportFacts({ icao }: { icao: string | null }) {
  const facts = await getAirportFacts(icao);
  if (!facts) return null;

  const t = await getTranslations("Weather");
  const elevFt = facts.elevationFt;

  return (
    <section className="border border-[#ccc] bg-white p-4">
      <h2 className="text-center text-xl font-normal">{t("facts")}</h2>

      <dl className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
        {elevFt != null && (
          <div className="flex gap-x-1">
            <dt className="text-drossgray-dark">{t("elevation")}:</dt>
            <dd className="font-medium">
              {elevFt} ft ({Math.round(elevFt * 0.3048)} m)
            </dd>
          </div>
        )}
      </dl>

      {facts.runways.length > 0 && (
        <div className="mt-3 text-center text-sm">
          <span className="text-drossgray-dark">{t("runways")}:</span>{" "}
          {facts.runways
            .map((r) =>
              [r.ident, r.lengthFt ? `${r.lengthFt} ft` : null, r.surface]
                .filter(Boolean)
                .join(" "),
            )
            .join(" · ")}
        </div>
      )}

      {facts.frequencies.length > 0 && (
        <div className="mt-2 text-center text-sm">
          <span className="text-drossgray-dark">{t("frequencies")}:</span>{" "}
          {facts.frequencies
            .map((f) => `${f.type} ${f.mhz}`.trim())
            .join(" · ")}
        </div>
      )}
    </section>
  );
}

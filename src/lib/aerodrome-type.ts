// Human labels for the OpenAIP airport `type` integer enum (from the public v1
// schema). This is a fixed standard vocabulary (aerodrome categories), so - like
// the METAR glossary in `metar-decode.ts` - it lives in code, not the i18n JSON.
// Full en / de / fr / nl; English fallback for the other site languages.
//
// This is the FACTUAL aerodrome category, not a permission matrix: OpenAIP has
// no reliable "which aircraft classes may operate" whitelist (only per-runway
// `exclusiveAircraftType` restrictions, usually empty), so we deliberately show
// the category rather than infer permissions.

type Labels = Record<number, string>;

const EN: Labels = {
  0: "Airport",
  1: "Glider site",
  2: "Airfield",
  3: "International airport",
  4: "Military heliport",
  5: "Military aerodrome",
  6: "Ultralight site",
  7: "Heliport",
  8: "Closed",
  9: "IFR airfield",
  10: "Water aerodrome",
  11: "Landing strip",
  12: "Agricultural strip",
  13: "Altiport",
};

const DE: Labels = {
  0: "Flugplatz",
  1: "Segelfluggelände",
  2: "Flugplatz (zivil)",
  3: "Internationaler Flughafen",
  4: "Militärischer Heliport",
  5: "Militärflugplatz",
  6: "UL-Fluggelände",
  7: "Hubschrauberlandeplatz",
  8: "Geschlossen",
  9: "IFR-Flugplatz",
  10: "Wasserflugplatz",
  11: "Landebahn",
  12: "Agrarflugplatz",
  13: "Gebirgslandeplatz",
};

const FR: Labels = {
  0: "Aérodrome",
  1: "Site de vol à voile",
  2: "Aérodrome (civil)",
  3: "Aéroport international",
  4: "Héliport militaire",
  5: "Aérodrome militaire",
  6: "Site ULM",
  7: "Héliport",
  8: "Fermé",
  9: "Aérodrome IFR",
  10: "Hydrobase",
  11: "Piste d'atterrissage",
  12: "Piste agricole",
  13: "Altiport",
};

const NL: Labels = {
  0: "Vliegveld",
  1: "Zweefvliegterrein",
  2: "Vliegveld (civiel)",
  3: "Internationale luchthaven",
  4: "Militaire helihaven",
  5: "Militair vliegveld",
  6: "ULV-terrein",
  7: "Helihaven",
  8: "Gesloten",
  9: "IFR-vliegveld",
  10: "Watervliegveld",
  11: "Landingsstrook",
  12: "Agrarische strook",
  13: "Altiport",
};

const BY_LANG: Record<string, Labels> = { en: EN, de: DE, fr: FR, nl: NL };

/**
 * Label for an OpenAIP airport-type code in the given language (falls back to
 * English), or null when the code is absent/unknown.
 */
export function aerodromeTypeLabel(
  code: number | null | undefined,
  lang: string,
): string | null {
  if (code == null) return null;
  return (BY_LANG[lang] ?? EN)[code] ?? EN[code] ?? null;
}

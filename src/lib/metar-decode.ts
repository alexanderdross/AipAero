// Dependency-free METAR / TAF decoder. Walks the raw report token by token and
// turns each coded group into a plain-language line, so pilots (and anyone who
// does not read METAR fluently) get the same information in words. Pure function,
// no API, runs server-side - the decoded lines land in the SSR HTML inside a
// <details> element, so there is no client JS and the content is crawlable.
//
// Coverage is the common METAR/TAF vocabulary (wind, visibility, present
// weather, clouds, temperature, pressure, and TAF validity / change groups).
// Unrecognized tokens are passed through verbatim (text left empty) rather than
// dropped, so nothing is silently hidden. The meteorological glossary is kept in
// code (not the i18n JSON) - it is a fixed standard vocabulary, not site copy -
// and is fully populated for en/de/fr/nl with an English fallback for the other
// locales (METAR abbreviations are English-derived and read the same everywhere).

type Gloss = Record<string, Partial<Record<string, string>> & { en: string }>;

// Single words / short fragments used to build the decoded sentences.
const W: Gloss = {
  metar: {
    en: "Routine observation",
    de: "Routinemeldung",
    fr: "Observation régulière",
    nl: "Routinewaarneming",
  },
  speci: {
    en: "Special observation",
    de: "Sondermeldung",
    fr: "Observation spéciale",
    nl: "Speciale waarneming",
  },
  taf: {
    en: "Terminal aerodrome forecast",
    de: "Flugplatzvorhersage",
    fr: "Prévision d'aérodrome",
    nl: "Luchthavenverwachting",
  },
  amended: {
    en: "(amended)",
    de: "(korrigiert)",
    fr: "(amendé)",
    nl: "(gewijzigd)",
  },
  corrected: {
    en: "(corrected)",
    de: "(berichtigt)",
    fr: "(corrigé)",
    nl: "(gecorrigeerd)",
  },
  auto: {
    en: "Automated station",
    de: "Automatische Station",
    fr: "Station automatique",
    nl: "Automatisch station",
  },
  station: { en: "Station", de: "Station", fr: "Station", nl: "Station" },
  observed: {
    en: "Observed day",
    de: "Beobachtet am Tag",
    fr: "Observé le jour",
    nl: "Waargenomen dag",
  },
  at: { en: "at", de: "um", fr: "à", nl: "om" },
  windFrom: { en: "Wind from", de: "Wind aus", fr: "Vent du", nl: "Wind uit" },
  calm: { en: "Wind calm", de: "Windstille", fr: "Vent calme", nl: "Windstil" },
  variableWind: {
    en: "Wind variable at",
    de: "Wind veränderlich mit",
    fr: "Vent variable à",
    nl: "Wind variabel met",
  },
  gusting: {
    en: "gusting",
    de: "in Böen bis",
    fr: "rafales à",
    nl: "vlagen tot",
  },
  varyingBetween: {
    en: "Wind varying between",
    de: "Wind schwankend zwischen",
    fr: "Vent variant entre",
    nl: "Wind varieert tussen",
  },
  and: { en: "and", de: "und", fr: "et", nl: "en" },
  visibility: { en: "Visibility", de: "Sicht", fr: "Visibilité", nl: "Zicht" },
  tenKmPlus: {
    en: "10 km or more",
    de: "10 km oder mehr",
    fr: "10 km ou plus",
    nl: "10 km of meer",
  },
  cavok: {
    en: "CAVOK - ceiling and visibility OK (>= 10 km, no significant cloud or weather)",
    de: "CAVOK - Sicht und Wolken in Ordnung (>= 10 km, keine nennenswerten Wolken/Wetter)",
    fr: "CAVOK - visibilité et plafond OK (>= 10 km, pas de nuage/temps significatif)",
    nl: "CAVOK - zicht en bewolking OK (>= 10 km, geen noemenswaardige bewolking/weer)",
  },
  temperature: {
    en: "Temperature",
    de: "Temperatur",
    fr: "Température",
    nl: "Temperatuur",
  },
  dewpoint: {
    en: "dew point",
    de: "Taupunkt",
    fr: "point de rosée",
    nl: "dauwpunt",
  },
  qnh: { en: "QNH", de: "QNH", fr: "QNH", nl: "QNH" },
  altimeter: {
    en: "Altimeter",
    de: "Höhenmesser",
    fr: "Calage",
    nl: "Hoogtemeter",
  },
  verticalVis: {
    en: "Vertical visibility",
    de: "Vertikalsicht",
    fr: "Visibilité verticale",
    nl: "Verticaal zicht",
  },
  cb: {
    en: "cumulonimbus",
    de: "Cumulonimbus",
    fr: "cumulonimbus",
    nl: "cumulonimbus",
  },
  tcu: {
    en: "towering cumulus",
    de: "aufquellender Cumulus",
    fr: "cumulus bourgeonnant",
    nl: "opbollende cumulus",
  },
  noClouds: {
    en: "No significant clouds",
    de: "Keine nennenswerten Wolken",
    fr: "Pas de nuage significatif",
    nl: "Geen noemenswaardige bewolking",
  },
  noWeather: {
    en: "No significant weather",
    de: "Kein nennenswertes Wetter",
    fr: "Pas de temps significatif",
    nl: "Geen noemenswaardig weer",
  },
  // TAF
  valid: {
    en: "Valid from",
    de: "Gültig von",
    fr: "Valable du",
    nl: "Geldig van",
  },
  to: { en: "to", de: "bis", fr: "au", nl: "tot" },
  from: { en: "From", de: "Ab", fr: "À partir de", nl: "Vanaf" },
  tempo: {
    en: "Temporarily:",
    de: "Zeitweise:",
    fr: "Temporairement:",
    nl: "Tijdelijk:",
  },
  becoming: {
    en: "Becoming:",
    de: "Übergehend:",
    fr: "En cours d'évolution:",
    nl: "Overgaand naar:",
  },
  probability: {
    en: "Probability",
    de: "Wahrscheinlichkeit",
    fr: "Probabilité",
    nl: "Waarschijnlijkheid",
  },
  noSignificant: {
    en: "No significant change expected",
    de: "Keine wesentliche Änderung erwartet",
    fr: "Aucun changement significatif prévu",
    nl: "Geen belangrijke verandering verwacht",
  },
};

// Cloud amount.
const COVER: Gloss = {
  FEW: {
    en: "Few clouds",
    de: "Vereinzelte Wolken",
    fr: "Quelques nuages",
    nl: "Enkele wolken",
  },
  SCT: {
    en: "Scattered clouds",
    de: "Aufgelockerte Wolken",
    fr: "Nuages épars",
    nl: "Verspreide wolken",
  },
  BKN: {
    en: "Broken clouds",
    de: "Durchbrochene Wolken",
    fr: "Nuages fragmentés",
    nl: "Gebroken bewolking",
  },
  OVC: {
    en: "Overcast",
    de: "Bedeckt",
    fr: "Ciel couvert",
    nl: "Geheel bewolkt",
  },
};

// Present-weather building blocks (intensity, descriptor, phenomenon).
const INTENSITY: Gloss = {
  "-": { en: "Light", de: "Leichter", fr: "Faible", nl: "Lichte" },
  "+": { en: "Heavy", de: "Starker", fr: "Fort", nl: "Zware" },
  VC: {
    en: "In the vicinity:",
    de: "In der Nähe:",
    fr: "À proximité:",
    nl: "In de omgeving:",
  },
};
const DESCRIPTOR: Gloss = {
  MI: { en: "shallow", de: "flach", fr: "mince", nl: "ondiep" },
  PR: { en: "partial", de: "teilweise", fr: "partiel", nl: "gedeeltelijk" },
  BC: { en: "patches of", de: "Schwaden", fr: "bancs de", nl: "flarden" },
  DR: {
    en: "low drifting",
    de: "fegend",
    fr: "chasse-poussière bas",
    nl: "opjagend",
  },
  BL: { en: "blowing", de: "treibend", fr: "chasse", nl: "opwaaiend" },
  SH: { en: "showers of", de: "Schauer", fr: "averses de", nl: "buien van" },
  TS: { en: "thunderstorm", de: "Gewitter", fr: "orage", nl: "onweer" },
  FZ: {
    en: "freezing",
    de: "gefrierend",
    fr: "se congelant",
    nl: "onderkoeld",
  },
};
const PHENOMENON: Gloss = {
  DZ: { en: "drizzle", de: "Niesel", fr: "bruine", nl: "motregen" },
  RA: { en: "rain", de: "Regen", fr: "pluie", nl: "regen" },
  SN: { en: "snow", de: "Schnee", fr: "neige", nl: "sneeuw" },
  SG: {
    en: "snow grains",
    de: "Schneegriesel",
    fr: "neige en grains",
    nl: "motsneeuw",
  },
  IC: {
    en: "ice crystals",
    de: "Eisnadeln",
    fr: "cristaux de glace",
    nl: "ijskristallen",
  },
  PL: {
    en: "ice pellets",
    de: "Eiskörner",
    fr: "granules de glace",
    nl: "ijskorrels",
  },
  GR: { en: "hail", de: "Hagel", fr: "grêle", nl: "hagel" },
  GS: {
    en: "small hail",
    de: "kleiner Hagel",
    fr: "grésil",
    nl: "kleine hagel",
  },
  UP: {
    en: "unknown precipitation",
    de: "unbekannter Niederschlag",
    fr: "précipitation inconnue",
    nl: "onbekende neerslag",
  },
  BR: { en: "mist", de: "feuchter Dunst", fr: "brume", nl: "nevel" },
  FG: { en: "fog", de: "Nebel", fr: "brouillard", nl: "mist" },
  FU: { en: "smoke", de: "Rauch", fr: "fumée", nl: "rook" },
  VA: {
    en: "volcanic ash",
    de: "Vulkanasche",
    fr: "cendres volcaniques",
    nl: "vulkanische as",
  },
  DU: { en: "widespread dust", de: "Staub", fr: "poussière", nl: "stof" },
  SA: { en: "sand", de: "Sand", fr: "sable", nl: "zand" },
  HZ: { en: "haze", de: "trockener Dunst", fr: "brume sèche", nl: "heiigheid" },
  PO: {
    en: "dust/sand whirls",
    de: "Staub-/Sandwirbel",
    fr: "tourbillons de poussière",
    nl: "stof-/zandhozen",
  },
  SQ: { en: "squalls", de: "Böen", fr: "grains", nl: "buiigheid" },
  FC: { en: "funnel cloud", de: "Trichterwolke", fr: "trombe", nl: "windhoos" },
  SS: {
    en: "sandstorm",
    de: "Sandsturm",
    fr: "tempête de sable",
    nl: "zandstorm",
  },
  DS: {
    en: "duststorm",
    de: "Staubsturm",
    fr: "tempête de poussière",
    nl: "stofstorm",
  },
  NSW: {
    en: "no significant weather",
    de: "kein nennenswertes Wetter",
    fr: "pas de temps significatif",
    nl: "geen noemenswaardig weer",
  },
};

function pick(g: Gloss, key: string, lang: string): string {
  const e = g[key];
  if (!e) return key;
  return e[lang] ?? e.en;
}

export interface DecodedLine {
  token: string; // the raw group, e.g. "06004KT"
  text: string; // plain-language decoding ("" when not recognized)
}

const int = (s: string) => parseInt(s, 10);
const signed = (s: string) => (s.startsWith("M") ? -int(s.slice(1)) : int(s));

function decodeWeatherGroup(tok: string, lang: string): string | null {
  const m =
    /^(-|\+|VC)?((?:MI|PR|BC|DR|BL|SH|TS|FZ)*)((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS|NSW)*)$/.exec(
      tok,
    );
  if (!m) return null;
  const inten = m[1];
  const descRaw = m[2] ?? "";
  const phenRaw = m[3] ?? "";
  if (!descRaw && !phenRaw) return null;
  const parts: string[] = [];
  if (inten) parts.push(pick(INTENSITY, inten, lang));
  for (let i = 0; i < descRaw.length; i += 2)
    parts.push(pick(DESCRIPTOR, descRaw.slice(i, i + 2), lang));
  for (let i = 0; i < phenRaw.length; i += 2)
    parts.push(pick(PHENOMENON, phenRaw.slice(i, i + 2), lang));
  return parts.join(" ");
}

/**
 * Decode a raw METAR or TAF string into an ordered list of {token, text} lines.
 * `lang` is a two-letter language code (en/de/fr/nl fully translated, others fall
 * back to English). Returns [] for an empty input.
 */
export function decodeReport(
  raw: string | null | undefined,
  lang: string,
): DecodedLine[] {
  if (!raw) return [];
  const tokens = raw.trim().replace(/=$/, "").split(/\s+/).filter(Boolean);
  const out: DecodedLine[] = [];
  let sawStation = false;

  for (const tok of tokens) {
    const push = (text: string) => out.push({ token: tok, text });

    // Report type.
    if (tok === "METAR") {
      push(pick(W, "metar", lang));
      continue;
    }
    if (tok === "SPECI") {
      push(pick(W, "speci", lang));
      continue;
    }
    if (tok === "TAF") {
      push(pick(W, "taf", lang));
      continue;
    }
    if (tok === "AMD") {
      push(pick(W, "amended", lang));
      continue;
    }
    if (tok === "COR") {
      push(pick(W, "corrected", lang));
      continue;
    }
    if (tok === "AUTO") {
      push(pick(W, "auto", lang));
      continue;
    }
    if (tok === "RMK") break; // remarks: non-standard, stop here

    // Station identifier (first 4-letter group).
    if (!sawStation && /^[A-Z]{4}$/.test(tok)) {
      sawStation = true;
      push(`${pick(W, "station", lang)}: ${tok}`);
      continue;
    }

    // Observation day/time DDHHMMZ.
    let mm = /^(\d{2})(\d{2})(\d{2})Z$/.exec(tok);
    if (mm) {
      push(
        `${pick(W, "observed", lang)} ${int(mm[1]!)}, ${mm[2]}:${mm[3]} UTC`,
      );
      continue;
    }

    // TAF validity DDHH/DDHH.
    mm = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(tok);
    if (mm) {
      push(
        `${pick(W, "valid", lang)} ${int(mm[1]!)}. ${mm[2]}:00 ${pick(W, "to", lang)} ${int(mm[3]!)}. ${mm[4]}:00 UTC`,
      );
      continue;
    }

    // TAF change groups.
    mm = /^FM(\d{2})(\d{2})(\d{2})$/.exec(tok);
    if (mm) {
      push(`${pick(W, "from", lang)} ${int(mm[1]!)}. ${mm[2]}:${mm[3]} UTC:`);
      continue;
    }
    if (tok === "TEMPO") {
      push(pick(W, "tempo", lang));
      continue;
    }
    if (tok === "BECMG") {
      push(pick(W, "becoming", lang));
      continue;
    }
    if (tok === "NOSIG") {
      push(pick(W, "noSignificant", lang));
      continue;
    }
    mm = /^PROB(\d{2})$/.exec(tok);
    if (mm) {
      push(`${pick(W, "probability", lang)} ${mm[1]}%`);
      continue;
    }

    // Wind DDDff(Gff)KT / VRBffKT / 00000KT.
    mm = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|MPH)$/.exec(tok);
    if (mm) {
      const [, dir, spd, gust, unitRaw] = mm;
      const unit = unitRaw === "KT" ? "kt" : unitRaw === "MPS" ? "m/s" : "mph";
      if (dir === "000" && spd === "00" && !gust) {
        push(pick(W, "calm", lang));
        continue;
      }
      let t =
        dir === "VRB"
          ? `${pick(W, "variableWind", lang)} ${int(spd!)} ${unit}`
          : `${pick(W, "windFrom", lang)} ${int(dir!)}° ${pick(W, "at", lang)} ${int(spd!)} ${unit}`;
      if (gust) t += `, ${pick(W, "gusting", lang)} ${int(gust)} ${unit}`;
      push(t);
      continue;
    }

    // Variable wind direction range dddVddd.
    mm = /^(\d{3})V(\d{3})$/.exec(tok);
    if (mm) {
      push(
        `${pick(W, "varyingBetween", lang)} ${int(mm[1]!)}° ${pick(W, "and", lang)} ${int(mm[2]!)}°`,
      );
      continue;
    }

    if (tok === "CAVOK") {
      push(pick(W, "cavok", lang));
      continue;
    }
    if (tok === "NSC" || tok === "NCD" || tok === "SKC" || tok === "CLR") {
      push(pick(W, "noClouds", lang));
      continue;
    }

    // Visibility in metres (9999 = 10 km or more).
    mm = /^(\d{4})$/.exec(tok);
    if (mm) {
      const v = int(mm[1]!);
      push(
        `${pick(W, "visibility", lang)}: ${v >= 9999 ? pick(W, "tenKmPlus", lang) : `${v} m`}`,
      );
      continue;
    }
    // Visibility in statute miles (US).
    mm = /^(\d{1,2})SM$/.exec(tok);
    if (mm) {
      push(`${pick(W, "visibility", lang)}: ${mm[1]} SM`);
      continue;
    }

    // Clouds FEWnnn / SCTnnn / BKNnnn / OVCnnn (+CB/TCU), or VVnnn.
    mm = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/.exec(tok);
    if (mm) {
      const alt = int(mm[2]!) * 100;
      let t = `${pick(COVER, mm[1]!, lang)} ${pick(W, "at", lang)} ${alt} ft`;
      if (mm[3] === "CB") t += ` (${pick(W, "cb", lang)})`;
      if (mm[3] === "TCU") t += ` (${pick(W, "tcu", lang)})`;
      push(t);
      continue;
    }
    mm = /^VV(\d{3})$/.exec(tok);
    if (mm) {
      push(`${pick(W, "verticalVis", lang)} ${int(mm[1]!) * 100} ft`);
      continue;
    }

    // Temperature / dew point Tn/Tn (M = minus).
    mm = /^(M?\d{2})\/(M?\d{2})$/.exec(tok);
    if (mm) {
      push(
        `${pick(W, "temperature", lang)} ${signed(mm[1]!)} °C, ${pick(W, "dewpoint", lang)} ${signed(mm[2]!)} °C`,
      );
      continue;
    }

    // Pressure QNH (hPa) or altimeter (inHg).
    mm = /^Q(\d{3,4})$/.exec(tok);
    if (mm) {
      push(`${pick(W, "qnh", lang)} ${int(mm[1]!)} hPa`);
      continue;
    }
    mm = /^A(\d{4})$/.exec(tok);
    if (mm) {
      push(
        `${pick(W, "altimeter", lang)} ${(int(mm[1]!) / 100).toFixed(2)} inHg`,
      );
      continue;
    }

    // Present weather.
    const wx = decodeWeatherGroup(tok, lang);
    if (wx) {
      push(wx);
      continue;
    }

    // Unknown token: keep it visible, no decoding text.
    push("");
  }

  return out;
}

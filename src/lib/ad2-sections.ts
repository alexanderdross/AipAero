/**
 * Segments the DE OCR'd AD-2 text blob (see `crawlers/crawlers/de_ocr.py`) into
 * the ICAO AD 2.x sections it contains, so the "AIP-Flugplatzinformationen"
 * block can render a scannable, sectioned layout instead of one wall of running
 * text - and can DROP the sections whose data is already shown in a dedicated
 * structured box (operating hours, runways, frequencies, location, weather).
 *
 * Why this lives on the display side and is best-effort:
 * - The blob is OCR text (garbled) with the AD 2.x section titles as fixed ICAO
 *   vocabulary; those titles live in CODE here (not i18n), mirroring the
 *   `metar-decode` glossary precedent - no new message keys, i18n parity holds.
 * - We split ONLY on top-level `AD 2.N` markers (the literal "AD" prefix is what
 *   distinguishes a real section from the sub-paragraph numbers "2.1"/"2.2"
 *   inside AD 2.20's local-regulations text - those carry no "AD"), reusing the
 *   OCR-tolerant spacing idiom proven in `crawlers/crawlers/de_hours.py`.
 * - The body prose is NEVER rewritten (safety: no fabrication); we only add a
 *   clean heading and, when confident, hide a redundant whole section.
 *
 * Safe failure direction: a section is flagged `redundant` (hidden by the
 * caller) ONLY when both its own start marker AND the next section's start
 * marker were detected - so if a boundary is mis-OCR'd and two sections merge,
 * the merged block is kept and shown, never hidden. And when the blob cannot be
 * confidently segmented at all (< 2 markers) `segmentAd2Text` returns null so
 * the caller falls back to the verbatim render - never worse than today.
 */

export type Ad2Lang = "de" | "en";

export type Ad2Section = {
  /** Normalised section code, e.g. "2.3" / "2.20", or null for ungrouped text. */
  code: string | null;
  /** Localized, canonical ICAO section heading (clean even when the body is not). */
  title: string;
  /** The section's OCR body text (verbatim, trimmed). */
  body: string;
  /** True when a dedicated structured box already shows this data -> hide it. */
  redundant: boolean;
};

// Canonical ICAO AD 2.x section titles (fixed vocabulary -> code, not i18n).
// German follows the AIP Germany (DFS) wording.
const AD2_TITLES: Record<Ad2Lang, Record<string, string>> = {
  de: {
    "2.1": "Flugplatzkennung und Name",
    "2.2": "Geographische und verwaltungstechnische Flugplatzdaten",
    "2.3": "Betriebszeiten",
    "2.4": "Abfertigungsdienste und Einrichtungen",
    "2.5": "Einrichtungen für Fluggäste",
    "2.6": "Rettungs- und Feuerlöschdienste",
    "2.7": "Verfügbarkeit nach Jahreszeit, Räumung",
    "2.8": "Vorfeld, Rollbahnen und Kontrollpunkte",
    "2.9": "Führung und Kontrolle der Bodenbewegungen, Markierungen",
    "2.10": "Flugplatzhindernisse",
    "2.11": "Bereitgestellte Wetterinformationen",
    "2.12": "Pistenphysische Eigenschaften",
    "2.13": "Erklärte Distanzen",
    "2.14": "Anflug- und Pistenbefeuerung",
    "2.15": "Sonstige Befeuerung, Ersatzstromversorgung",
    "2.16": "Hubschrauberlandebereich",
    "2.17": "ATS-Luftraum",
    "2.18": "ATS-Kommunikationseinrichtungen",
    "2.19": "Funknavigations- und Landehilfen",
    "2.20": "Örtliche Flugbeschränkungen",
    "2.21": "Lärmschutzverfahren",
    "2.22": "Flugverfahren",
    "2.23": "Zusätzliche Informationen",
    "2.24": "Karten für den Flugplatz",
  },
  en: {
    "2.1": "Aerodrome location indicator and name",
    "2.2": "Aerodrome geographical and administrative data",
    "2.3": "Operational hours",
    "2.4": "Handling services and facilities",
    "2.5": "Passenger facilities",
    "2.6": "Rescue and fire fighting services",
    "2.7": "Seasonal availability - clearing",
    "2.8": "Aprons, taxiways and check locations data",
    "2.9": "Surface movement guidance and control system and markings",
    "2.10": "Aerodrome obstacles",
    "2.11": "Meteorological information provided",
    "2.12": "Runway physical characteristics",
    "2.13": "Declared distances",
    "2.14": "Approach and runway lighting",
    "2.15": "Other lighting, secondary power supply",
    "2.16": "Helicopter landing area",
    "2.17": "ATS airspace",
    "2.18": "ATS communication facilities",
    "2.19": "Radio navigation and landing aids",
    "2.20": "Local aerodrome regulations",
    "2.21": "Noise abatement procedures",
    "2.22": "Flight procedures",
    "2.23": "Additional information",
    "2.24": "Charts related to an aerodrome",
  },
};

// Heading for text that carries no recognised AD 2.x code (a leading preamble,
// or an unknown/garbled section number) - so nothing is ever silently dropped.
const AD2_FALLBACK: Record<Ad2Lang, string> = {
  de: "Weitere AIP-Angaben",
  en: "Further AIP information",
};

// Sections whose data is already shown in a dedicated structured box:
//  2.1/2.2 location, coordinates, operator -> contact/facts;
//  2.3 operating hours -> the hours badge + weekday table (hoursStructured);
//  2.11 weather -> the METAR/TAF box; 2.12 runways -> the facts runways;
//  2.13 declared distances -> the structured declared-distances line;
//  2.18 ATS communication -> the facts frequencies.
// The AD 2.20-2.23 free-text local sections (Platzrunde/noise/procedures) are
// the block's unique value and are NEVER in this set.
const AD2_REDUNDANT = new Set([
  "2.1",
  "2.2",
  "2.3",
  "2.11",
  "2.12",
  "2.13",
  "2.18",
]);

// Top-level AD 2.N marker. The literal "AD" prefix is required so the
// sub-paragraph numbers ("2.1 Nachtflüge", "2.2 Platzrundenflüge") INSIDE AD
// 2.20 are not mistaken for sections. `2\.?\s*` tolerates the OCR dropping the
// dot or spacing it ("AD 2.20", "AD 220", "AD 2 20"). Global for matchAll.
const AD2_MARKER_RE = /\bAD\s*2\.?\s*(\d{1,2})\b/gi;

/** Strip a leading echo of the section's own title from the OCR body (the OCR
 * repeats the printed heading after the number, e.g. "... AD 2.20 Local
 * aerodrome regulations 1. ..."). Conservative: only removes it when the body
 * begins with the (whitespace-normalised, case-insensitive) canonical title, so
 * a garbled OCR title is simply left in place. */
function stripLeadingTitle(body: string, title: string): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const t = norm(title);
  if (t && norm(body).startsWith(t)) {
    // Remove that many "visible" characters, tolerant of the body's own spacing.
    let removed = 0;
    let i = 0;
    while (i < body.length && removed < t.length) {
      if (/\s/.test(body[i]!)) {
        // collapse any run of whitespace to the single space the norm used
        while (i < body.length && /\s/.test(body[i]!)) i++;
        removed++; // the single normalised space
      } else {
        i++;
        removed++;
      }
    }
    return body
      .slice(i)
      .replace(/^[\s.,:;-]+/, "")
      .trim();
  }
  return body;
}

/**
 * Split the OCR AD-2 blob into its AD 2.x sections. Returns null only when NO
 * section marker is found (so the caller renders the verbatim text). A single
 * marker is enough: a DE field whose captured OCR is one section (commonly just
 * AD 2.20 "Local aerodrome regulations") still gets its clean heading instead of
 * a flat wall of text.
 */
export function segmentAd2Text(
  blob: string | null | undefined,
  lang: Ad2Lang,
): Ad2Section[] | null {
  if (!blob || typeof blob !== "string") return null;
  const matches = [...blob.matchAll(AD2_MARKER_RE)];
  if (matches.length < 1) return null;

  const titles = AD2_TITLES[lang];
  const sections: Ad2Section[] = [];

  // Leading text before the first marker. Usually the DFS page/book header
  // ("LUFTFAHRTHANDBUCH ... AD 2 EDMA 1-7 16 APR 2026 EDMA") - all-caps codes,
  // not aerodrome content - so drop it when it carries no real prose (fewer than
  // two lowercase words); keep a genuine leading narrative under a generic
  // heading so nothing real is lost.
  const lead = blob.slice(0, matches[0]!.index).trim();
  const leadWords = (lead.match(/\b[a-zäöü]{3,}\b/g) ?? []).length;
  if (lead.length > 0 && leadWords >= 2) {
    sections.push({
      code: null,
      title: AD2_FALLBACK[lang],
      body: lead,
      redundant: false,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const code = `2.${m[1]}`;
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : blob.length;
    const title = titles[code] ?? AD2_FALLBACK[lang];
    const body = stripLeadingTitle(blob.slice(start, end).trim(), title);
    // Only hide a redundant section when the NEXT boundary is also known, so a
    // merged (mis-OCR'd) block is never hidden with unique content inside it.
    const nextBoundaryKnown = i + 1 < matches.length;
    const redundant = AD2_REDUNDANT.has(code) && nextBoundaryKnown;
    sections.push({ code, title, body, redundant });
  }

  return sections;
}

/**
 * The visible (non-redundant) sections joined back into a plain string - used
 * for the Airport JSON-LD OCR PropertyValue so the structured data matches the
 * trimmed DOM. Falls back to the whole blob when it cannot be segmented.
 */
export function keptAd2Text(
  blob: string | null | undefined,
  lang: Ad2Lang,
): string {
  const sections = segmentAd2Text(blob, lang);
  if (!sections) return blob ?? "";
  return sections
    .filter((s) => !s.redundant)
    .map((s) => (s.body ? `${s.title}: ${s.body}` : s.title))
    .join("\n\n");
}

// A zero-width boundary BEFORE a numbered sub-item marker ("1. ", "2. ",
// "2.1 ", "3. ") followed by a capitalised word. A DOT is REQUIRED in the
// marker, so the dot-less OCR mis-reads of deeper items ("24" for "2.4") and -
// crucially - ordinary numbers like "24 Stunden", a "14.000 Kg" weight or a
// "0600" time never start a break. `(?<![\d.])` stops a match starting inside a
// longer number. Splitting on this zero-width point keeps the marker at the
// start of each item; it is purely a display split and never rewrites the text.
const _SUBITEM_SPLIT_RE =
  /(?=(?<![\d.])\d{1,2}\.(?:\d{1,2})?\s+[A-Z\u00c4\u00d6\u00dc])/;

/**
 * Break a section body into its numbered sub-items for a scannable layout (AD
 * 2.20 local regulations especially is a long numbered narrative). Returns the
 * body as a single entry when it has no confident sub-item boundaries, so a
 * plain single-paragraph section renders unchanged. Cosmetic only - it never
 * rewrites or drops any of the (OCR) text.
 */
export function splitSubItems(body: string): string[] {
  if (!body) return [];
  return body
    .split(_SUBITEM_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A TEL-labelled phone number inside the AD 2.2 administrative block. Anchored
// on "TEL"/"TELEFON" (never "TELEFAX" - the optional group + a required label
// separator before the digits means "TELEFAX" cannot match) so a fax number is
// not picked up. Captures an international/national token (leading "+" and
// grouping punctuation allowed).
const AD2_PHONE_RE = /\bTEL(?:EFON)?\s*[:.]?\s*(\+?\(?\d[\d\s()/.-]{5,}\d)/i;

/**
 * Best-effort aerodrome-operator phone number from the DE OCR AD-2 blob, read
 * ONLY from the AD 2.2 (administrative data) section - never the whole blob, so
 * an ACC/coordination number that appears in AD 2.20's local-regulations text is
 * not mistaken for the operator's line. A NOISY source: used ONLY as the last
 * fallback below the OSM phone, and validated to a plausible 7-15 digit count so
 * a badly OCR'd token is rejected rather than shown. Returns null when AD 2.2 is
 * absent / unsegmentable or no plausible TEL number is found.
 */
export function extractAd2Phone(
  blob: string | null | undefined,
): string | null {
  const sections = segmentAd2Text(blob, "en");
  const admin = sections?.find((s) => s.code === "2.2");
  if (!admin) return null;
  const m = AD2_PHONE_RE.exec(admin.body);
  if (!m) return null;
  const token = m[1]!.replace(/\s+/g, " ").trim();
  const digits = (token.match(/\d/g) ?? []).length;
  if (digits < 7 || digits > 15) return null; // implausible OCR -> reject
  return token;
}

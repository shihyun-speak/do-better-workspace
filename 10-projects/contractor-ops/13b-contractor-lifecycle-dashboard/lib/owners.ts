export const APAC_COUNTRIES = [
  // East Asia
  "japan", "korea", "south korea", "republic of korea",
  "taiwan", "china", "hong kong", "mongolia", "macau", "macao",
  // Southeast Asia
  "singapore", "philippines", "vietnam", "thailand", "indonesia",
  "malaysia", "cambodia", "laos", "myanmar", "burma", "brunei",
  "timor-leste", "east timor",
  // South Asia
  "india", "pakistan", "bangladesh", "sri lanka", "nepal",
  "bhutan", "maldives", "afghanistan",
  // Pacific / Oceania
  "australia", "new zealand", "fiji", "papua new guinea",
];

// US states + DC + territories. Lowercase forms. Used to detect when the form's
// "Country of Residence (or US State)" field actually holds a US state so we
// can render it as "US, Massachusetts" instead of bare "Massachusetts".
const US_STATES: Record<string, string> = {
  "alabama": "Alabama", "al": "Alabama",
  "alaska": "Alaska", "ak": "Alaska",
  "arizona": "Arizona", "az": "Arizona",
  "arkansas": "Arkansas", "ar": "Arkansas",
  "california": "California", "ca": "California",
  "colorado": "Colorado", "co": "Colorado",
  "connecticut": "Connecticut", "ct": "Connecticut",
  "delaware": "Delaware", "de": "Delaware",
  "florida": "Florida", "fl": "Florida",
  "georgia": "Georgia", "ga": "Georgia",
  "hawaii": "Hawaii", "hi": "Hawaii",
  "idaho": "Idaho", "id": "Idaho",
  "illinois": "Illinois", "il": "Illinois",
  "indiana": "Indiana", "in": "Indiana",
  "iowa": "Iowa", "ia": "Iowa",
  "kansas": "Kansas", "ks": "Kansas",
  "kentucky": "Kentucky", "ky": "Kentucky",
  "louisiana": "Louisiana", "la": "Louisiana",
  "maine": "Maine", "me": "Maine",
  "maryland": "Maryland", "md": "Maryland",
  "massachusetts": "Massachusetts", "ma": "Massachusetts",
  "michigan": "Michigan", "mi": "Michigan",
  "minnesota": "Minnesota", "mn": "Minnesota",
  "mississippi": "Mississippi", "ms": "Mississippi",
  "missouri": "Missouri", "mo": "Missouri",
  "montana": "Montana", "mt": "Montana",
  "nebraska": "Nebraska", "ne": "Nebraska",
  "nevada": "Nevada", "nv": "Nevada",
  "new hampshire": "New Hampshire", "nh": "New Hampshire",
  "new jersey": "New Jersey", "nj": "New Jersey",
  "new mexico": "New Mexico", "nm": "New Mexico",
  "new york": "New York", "ny": "New York",
  "north carolina": "North Carolina", "nc": "North Carolina",
  "north dakota": "North Dakota", "nd": "North Dakota",
  "ohio": "Ohio", "oh": "Ohio",
  "oklahoma": "Oklahoma", "ok": "Oklahoma",
  "oregon": "Oregon", "or": "Oregon",
  "pennsylvania": "Pennsylvania", "pa": "Pennsylvania",
  "rhode island": "Rhode Island", "ri": "Rhode Island",
  "south carolina": "South Carolina", "sc": "South Carolina",
  "south dakota": "South Dakota", "sd": "South Dakota",
  "tennessee": "Tennessee", "tn": "Tennessee",
  "texas": "Texas", "tx": "Texas",
  "utah": "Utah", "ut": "Utah",
  "vermont": "Vermont", "vt": "Vermont",
  "virginia": "Virginia", "va": "Virginia",
  "washington": "Washington", "wa": "Washington",
  "west virginia": "West Virginia", "wv": "West Virginia",
  "wisconsin": "Wisconsin", "wi": "Wisconsin",
  "wyoming": "Wyoming", "wy": "Wyoming",
  "district of columbia": "District of Columbia", "dc": "District of Columbia",
  "washington dc": "District of Columbia", "washington, dc": "District of Columbia",
  "puerto rico": "Puerto Rico", "pr": "Puerto Rico",
};

// Common 2-letter country code aliases to canonical display names. Only the
// ones likely to appear in the form (we hire from APAC + a few other places).
const COUNTRY_ALIASES: Record<string, string> = {
  "kr": "South Korea",
  "jp": "Japan",
  "tw": "Taiwan",
  "sg": "Singapore",
  "hk": "Hong Kong",
  "cn": "China",
  "ph": "Philippines",
  "vn": "Vietnam",
  "th": "Thailand",
  "id": "Indonesia",
  "my": "Malaysia",
  "in": "India",
  "au": "Australia",
  "nz": "New Zealand",
  "uk": "United Kingdom",
  "gb": "United Kingdom",
  "de": "Germany",
  "fr": "France",
  "es": "Spain",
  "it": "Italy",
  "nl": "Netherlands",
  "mx": "Mexico",
  "br": "Brazil",
  // "CA" and "AR" intentionally NOT mapped — they collide with US state codes
  // California / Arkansas, which are more common in our data. Users typing
  // those codes meaning Canada/Argentina should spell out the full name.
  "korea": "South Korea",
  "republic of korea": "South Korea",
  "kr seoul": "South Korea",
  "seoul": "South Korea",
  "tokyo": "Japan",
  "osaka": "Japan",
  "taipei": "Taiwan",
};

/**
 * Normalize the "Country of Residence (or US State)" field for display.
 * Three cases:
 *   1. Matches a US state → "US, {State}"
 *   2. Matches a known country alias (e.g. "kr", "korea") → canonical name
 *   3. Otherwise → returned as-is (trimmed)
 *
 * Handles trailing "US" / "U.S." / "USA" / "United States" suffixes (with or
 * without comma) by stripping them before lookup, so "California, US" maps
 * to "US, California" the same as bare "California".
 *
 * NOTE on ambiguity: "CA" alone is treated as the state California (more
 * common in our data than Canada). "AR" alone is treated as the state
 * Arkansas. If a country is intended, the form should say "Canada" /
 * "Argentina" explicitly.
 */
export function formatCountry(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Strip trailing US-suffix variants so "California, US" and "New York, U.S."
  // get reduced to "California" / "New York" before lookup.
  const stripped = trimmed
    .replace(/[,\s]+(u\.?s\.?a?\.?|usa|united\s*states(\s*of\s*america)?)\.?$/i, "")
    .trim();
  const key = stripped.toLowerCase();

  // Exact-key US state / country match (handles "California", "kr seoul").
  const state = US_STATES[key];
  if (state) return `US, ${state}`;
  const country = COUNTRY_ALIASES[key];
  if (country) return country;

  // Tokenize and check each token. Catches free-form variants like
  // "Seoul, KR" / "KR-Seoul" / "South Korea (Seoul)" that exact-key lookup
  // misses. Country aliases checked first because "in" appears in many
  // unrelated state names ("Indiana", "Washington"). 2-letter tokens only
  // count when written in caps ("KR", "OR"), so words like "or" / "in" in
  // free text don't match a state code.
  const tokens = stripped
    .split(/[\s,.;/()\-]+/)
    .filter((t) => t && (t.length > 2 || t === t.toUpperCase()))
    .map((t) => t.toLowerCase());
  for (const tok of tokens) {
    const c = COUNTRY_ALIASES[tok];
    if (c) return c;
  }
  for (const tok of tokens) {
    const s = US_STATES[tok];
    if (s) return `US, ${s}`;
  }

  return trimmed;
}

export type Owner = "apac" | "row" | "unknown";

export function ownerFor(country: string | undefined | null): Owner {
  if (!country) return "unknown";
  // Resolve 2-letter codes / aliases first (e.g. "HK" → "Hong Kong"), then
  // match against the APAC list. Without this, codes typed in the form
  // bypassed APAC routing and got bucketed as RoW.
  const lower = formatCountry(country).toLowerCase();
  for (const c of APAC_COUNTRIES) {
    if (lower.includes(c)) return "apac";
  }
  return "row";
}

export function ownerLabel(owner: Owner): string {
  if (owner === "apac") return "Shihyun (APAC)";
  if (owner === "row") return "Hemmi (US + RoW)";
  return "Country unknown";
}

const NAME_ALIASES: Record<string, string> = {
  "katya hadjipetkova": "ekaterina hadjipetkova",
  "min oh": "minjin oh",
  "mateo arturo marin": "mateo arturo",
};

export function canonicalName(name: string | undefined | null): string {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  return NAME_ALIASES[lower] || lower;
}

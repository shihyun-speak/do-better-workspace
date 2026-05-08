export const APAC_COUNTRIES = [
  "japan", "korea", "south korea", "republic of korea",
  "taiwan", "singapore", "hong kong", "china", "philippines",
  "vietnam", "thailand", "indonesia", "malaysia", "india",
  "australia", "new zealand",
];

export type Owner = "apac" | "row" | "unknown";

export function ownerFor(country: string | undefined | null): Owner {
  if (!country) return "unknown";
  const lower = country.toLowerCase();
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
};

export function canonicalName(name: string | undefined | null): string {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  return NAME_ALIASES[lower] || lower;
}

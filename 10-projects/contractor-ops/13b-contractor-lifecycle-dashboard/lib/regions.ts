import type { Owner } from "./owners";

/**
 * Two working regions: APAC (Shihyun) and US + RoW (Hemmi). The `Owner`
 * type already lumps US into "row" for routing; the US / RoW split is only
 * a display detail (see OwnerPill).
 */
export type Region = "apac" | "usrow" | "all";

export const REGIONS: { key: Region; label: string }[] = [
  { key: "all", label: "All" },
  { key: "apac", label: "APAC" },
  { key: "usrow", label: "US + RoW" },
];

export function inRegion(owner: Owner, region: Region): boolean {
  if (region === "all") return true;
  if (region === "apac") return owner === "apac";
  return owner === "row";
}

/**
 * Region the page opens on. Everyone starts on All (Shihyun, 2026-10-28);
 * kept as a function so per-person defaults can come back later.
 */
export function defaultRegionFor(_email: string | null | undefined): Region {
  return "all";
}

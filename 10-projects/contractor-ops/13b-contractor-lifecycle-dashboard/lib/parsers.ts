import { readRange } from "./sheets";
import { parseDate, workingDaysUntil } from "./dates";
import { canonicalName, ownerFor, type Owner } from "./owners";

export type SotLifecycle =
  | "active"
  | "ending_soon"
  | "onboarding"
  | "inactive";

export type SotEntry = {
  source: "sot";
  name: string;
  jobTitle: string;
  department: string;
  manager: string;
  approver: string;
  /** Raw value from the sheet's Status column. */
  rawStatus: string;
  /**
   * Display status: passes through what's in the sheet, but adds an auto
   * "Ending Soon" hint when the contract has <=10 working days left, and
   * "Expired" when the end date is past but Status hasn't been updated.
   */
  displayStatus: string;
  lifecycle: SotLifecycle;
  startDate: string | null;
  endDate: string | null;
  country: string;
  owner: Owner;
  /** 1-based row in the SoT tab (header row = 2 in the sheet itself, but the
   *  parser reads from A2 so the offset already accounts for it).
   */
  rowIndex: number;
};

const ENDING_SOON_THRESHOLD_DAYS = 10;

export type RequestSource =
  | "onboarding"
  | "extension"
  | "offboarding"
  | "rate_change";

export type RequestEntry = {
  source: RequestSource;
  requestType: "Onboarding" | "Extension" | "Offboarding" | "Rate Change";
  name: string;
  manager: string;
  approver: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  newEndDate: string | null;
  priorEndDate: string | null;
  effectiveDate: string | null;
  country: string;
  owner: Owner;
  /** 1-based row number in the source sheet — needed to write back to col A. */
  rowIndex: number;
};

const CLOSED_ONBOARDING = new Set(["active", "ended", "void"]);
const CLOSED_EXTENSION = new Set(["active", "void"]);
const CLOSED_OFFBOARDING = new Set(["completed", "void", "#ref!"]);
const CLOSED_RATE_CHANGE = new Set(["completed", "void"]);

function pad(row: string[], len: number): string[] {
  if (row.length < len) return [...row, ...Array(len - row.length).fill("")];
  return row;
}

function isoDate(s: string | undefined | null): string | null {
  const d = parseDate(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function loadCountryLookup(): Promise<{
  byName: Map<string, string>;
  bySubmissionTime: { name: string; country: string; ts: string | null }[];
}> {
  const rows = await readRange("'Form Responses'!A:H");
  const byName = new Map<string, string>();
  const bySubmissionTime: { name: string; country: string; ts: string | null }[] = [];
  for (const raw of rows.slice(1)) {
    const row = pad(raw, 8);
    const ts = row[0]?.trim() || null;
    const name = canonicalName(row[3]);
    const country = (row[7] || "").trim();
    if (name && country) {
      byName.set(name, country);
      bySubmissionTime.push({ name, country, ts });
    }
  }
  return { byName, bySubmissionTime };
}

function classifySot(
  rawStatus: string,
  endDate: string | null,
  rowHasError: boolean,
): { lifecycle: SotLifecycle; displayStatus: string } {
  const lower = rawStatus.trim().toLowerCase();

  if (rowHasError) {
    return { lifecycle: "inactive", displayStatus: "Data error" };
  }
  if (lower === "ended" || lower === "voided" || lower === "void") {
    return {
      lifecycle: "inactive",
      displayStatus: rawStatus.trim() || "Ended",
    };
  }

  // Onboarding takes priority over the auto-derived "Ending Soon" — if a
  // person is freshly being onboarded, that's the more relevant signal even
  // if the contract has a short term.
  if (lower === "onboarding") {
    return { lifecycle: "onboarding", displayStatus: "Onboarding" };
  }

  // Manually-set "Ending soon" (the sheet writes it lowercase 's').
  if (lower === "ending soon") {
    return { lifecycle: "ending_soon", displayStatus: "Ending Soon" };
  }

  if (endDate) {
    const wd = workingDaysUntil(new Date(endDate));
    if (wd < 0) {
      return { lifecycle: "inactive", displayStatus: "Expired" };
    }
    if (wd <= ENDING_SOON_THRESHOLD_DAYS) {
      return { lifecycle: "ending_soon", displayStatus: "Ending Soon" };
    }
  }

  if (!lower) {
    return { lifecycle: "active", displayStatus: "—" };
  }
  return {
    lifecycle: "active",
    displayStatus: rawStatus.trim() || "Active",
  };
}

export async function loadSot(): Promise<SotEntry[]> {
  const [rows, countries] = await Promise.all([
    readRange("'[SoT] Contractor Tracker'!A2:H"),
    loadCountryLookup(),
  ]);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const out: SotEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 8);
    const entry: Record<string, string> = {};
    headers.forEach((h, j) => (entry[h] = row[j] || ""));
    const rawStatus = (entry["Status"] || "").trim();
    if (rawStatus.toLowerCase() === "status") continue; // header-row repeat
    const name = (entry["Contractor Name"] || "").trim();
    if (!name) continue;

    const rowHasError = row.some((cell) => /#(N\/A|REF!|VALUE!|NAME\?)/i.test(cell));
    const startDate = isoDate(entry["Start Date"]);
    const endDate = isoDate(entry["End Date"]);
    const { lifecycle, displayStatus } = classifySot(rawStatus, endDate, rowHasError);

    const country = countries.byName.get(canonicalName(name)) || "";
    out.push({
      source: "sot",
      name,
      jobTitle: (entry["Job Title"] || "").trim(),
      department: (entry["Department"] || "").trim(),
      manager: (entry["Speak Manager"] || "").trim(),
      approver: (entry["Contractor Invoice Approver"] || "").trim(),
      rawStatus,
      displayStatus,
      lifecycle,
      startDate,
      endDate,
      country,
      owner: ownerFor(country),
      rowIndex: i + 2,
    });
  }
  return out;
}

function approverFromSot(sot: SotEntry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of sot) {
    if (e.approver) m.set(canonicalName(e.name), e.approver);
  }
  return m;
}

export async function loadOnboarding(
  sot: SotEntry[],
  countries: Map<string, string>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Onboarding!A:O");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const out: RequestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 15);
    const status = (row[0] || "").trim();
    if (CLOSED_ONBOARDING.has(status.toLowerCase())) continue;
    const name = (row[3] || "").trim();
    if (!name) continue;
    const country = countries.get(canonicalName(name)) || "";
    out.push({
      source: "onboarding",
      requestType: "Onboarding",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(canonicalName(name)) || "",
      status,
      startDate: isoDate(row[13]),
      endDate: isoDate(row[14]),
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
    });
  }
  return out;
}

export async function loadExtension(
  sot: SotEntry[],
  countries: Map<string, string>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Extension!A:F");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const priorEnds = await loadPriorEndDates();
  const byName = new Map<string, RequestEntry>();
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 6);
    const status = (row[0] || "").trim();
    if (CLOSED_EXTENSION.has(status.toLowerCase())) continue;
    const name = (row[3] || "").trim();
    if (!name) continue;
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    byName.set(key, {
      source: "extension",
      requestType: "Extension",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      startDate: null,
      endDate: null,
      newEndDate: isoDate(row[4]),
      priorEndDate: priorEnds.get(key) || null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
    });
  }
  return Array.from(byName.values());
}

async function loadPriorEndDates(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const onboarding = await readRange("Onboarding!A:O");
  for (const raw of onboarding.slice(1)) {
    const row = pad(raw, 15);
    const name = (row[3] || "").trim();
    if (!name) continue;
    const d = isoDate(row[14]);
    if (d) out.set(canonicalName(name), d);
  }
  const ext = await readRange("Extension!A:F");
  for (const raw of ext.slice(1)) {
    const row = pad(raw, 6);
    if ((row[0] || "").trim().toLowerCase() !== "active") continue;
    const name = (row[3] || "").trim();
    if (!name) continue;
    const d = isoDate(row[4]);
    if (d) out.set(canonicalName(name), d);
  }
  return out;
}

export async function loadOffboarding(
  sot: SotEntry[],
  countries: Map<string, string>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Offboarding!A:H");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const byName = new Map<string, RequestEntry>();
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 8);
    const status = (row[0] || "").trim();
    if (CLOSED_OFFBOARDING.has(status.toLowerCase())) continue;
    const name = (row[3] || "").trim();
    if (!name) continue;
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    byName.set(key, {
      source: "offboarding",
      requestType: "Offboarding",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      startDate: null,
      endDate: isoDate(row[4]),
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
    });
  }
  return Array.from(byName.values());
}

export async function loadRateChange(
  sot: SotEntry[],
  countries: Map<string, string>,
): Promise<RequestEntry[]> {
  const rows = await readRange("'Rate Change'!A:I");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const byName = new Map<string, RequestEntry>();
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 9);
    const status = (row[0] || "").trim();
    if (CLOSED_RATE_CHANGE.has(status.toLowerCase())) continue;
    const name = (row[3] || "").trim();
    if (!name) continue;
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    byName.set(key, {
      source: "rate_change",
      requestType: "Rate Change",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      startDate: null,
      endDate: null,
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: isoDate(row[5]),
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
    });
  }
  return Array.from(byName.values());
}

export type DashboardData = {
  fetchedAt: string;
  sot: SotEntry[];
  onboarding: RequestEntry[];
  extension: RequestEntry[];
  offboarding: RequestEntry[];
  rateChange: RequestEntry[];
};

export async function loadAll(): Promise<DashboardData> {
  const [sot, countries] = await Promise.all([loadSot(), loadCountryLookup()]);
  const [onboarding, extension, offboarding, rateChange] = await Promise.all([
    loadOnboarding(sot, countries.byName),
    loadExtension(sot, countries.byName),
    loadOffboarding(sot, countries.byName),
    loadRateChange(sot, countries.byName),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    sot,
    onboarding,
    extension,
    offboarding,
    rateChange,
  };
}

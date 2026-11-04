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
  /**
   * True when the row's status is a terminal one for its tab (e.g. Onboarding
   * "Active", Offboarding "Completed"). Still surfaced in the UI but pinned
   * to the bottom and greyed out — kept as a reference, not a todo.
   */
  closed: boolean;
  startDate: string | null;
  endDate: string | null;
  newEndDate: string | null;
  priorEndDate: string | null;
  effectiveDate: string | null;
  country: string;
  owner: Owner;
  /** 1-based row number in the source sheet — needed to write back to col A. */
  rowIndex: number;
  /** Onboarding only: from the request form. */
  /** Contractor's personal email (Onboarding col E). */
  email?: string;
  jobTitle?: string;
  department?: string;
  scopeOfWork?: string;
  paymentType?: string;
  paymentRate?: string;
  maxWeeklyHours?: string;
  saasTools?: string;
  workingLocation?: string;
  /** Offboarding only. */
  terminationReason?: string;
  notifiedFlag?: string;
  /** Rate Change only. */
  newPaymentRate?: string;
  /** Extension only: answer to "Has the scope of work and/or payment rate changed?". */
  scopeOrRateChanged?: string;
  /** ISO date of the form submission (from Form Responses timestamp), if known. */
  requestedAt?: string | null;
};

const CLOSED_ONBOARDING = new Set(["active", "ended", "void"]);
const CLOSED_EXTENSION = new Set(["active", "void"]);
const CLOSED_OFFBOARDING = new Set(["completed", "void", "#ref!"]);
const CLOSED_RATE_CHANGE = new Set(["completed", "void"]);

/**
 * Whether a (source, status) pair counts as terminal for that request tab.
 * Mirrors the per-tab logic used by each loader so the UI can recompute the
 * `closed` flag after an optimistic status edit without re-fetching.
 */
export function isClosedStatus(source: RequestSource, status: string): boolean {
  const s = status.trim().toLowerCase();
  if (source === "onboarding") return CLOSED_ONBOARDING.has(s);
  if (source === "extension") return CLOSED_EXTENSION.has(s);
  if (source === "offboarding") return CLOSED_OFFBOARDING.has(s);
  if (source === "rate_change") return CLOSED_RATE_CHANGE.has(s);
  return false;
}

function pad(row: string[], len: number): string[] {
  if (row.length < len) return [...row, ...Array(len - row.length).fill("")];
  return row;
}

function isoDate(s: string | undefined | null): string | null {
  const d = parseDate(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * Pop the most recent timestamp for a given (canonical name, request type)
 * from the requestTimestamps map. Mutates the map's value array so subsequent
 * rows of the same name+type get the next-most-recent timestamp. Returns
 * null if no match.
 */
function popTimestamp(
  timestamps: Map<string, string[]> | undefined,
  name: string,
  kind: RequestSource,
): string | null {
  if (!timestamps || !name) return null;
  const key = `${name}::${kind}`;
  const list = timestamps.get(key);
  if (!list || list.length === 0) return null;
  return list.shift() || null;
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

/**
 * Returns a Map keyed by `${canonical-name}::${request-type}` → array of ISO
 * dates (newest first), one per Form Responses row matching that key. Used to
 * stamp each request-tab row with its submission date.
 *
 * Form Responses col A = Timestamp, D = Contractor's Full Name, E = request type.
 * Request types in the form (col E):
 *   "Onboarding a New Contractor"  → "onboarding"
 *   "Current Contractor Extension" → "extension"
 *   "Offboarding a Contractor"     → "offboarding"
 *   "Contractor Rate Change"       → "rate_change"
 */
export async function loadRequestTimestamps(): Promise<Map<string, string[]>> {
  const rows = await readRange("'Form Responses'!A:E");
  const out = new Map<string, string[]>();
  for (const raw of rows.slice(1)) {
    const row = pad(raw, 5);
    const ts = row[0]?.trim();
    const name = canonicalName(row[3]);
    const formType = (row[4] || "").toLowerCase();
    if (!ts || !name) continue;
    let kind: RequestSource | null = null;
    if (formType.includes("onboarding")) kind = "onboarding";
    else if (formType.includes("extension")) kind = "extension";
    else if (formType.includes("offboarding") || formType.includes("termination")) {
      kind = "offboarding";
    } else if (formType.includes("rate")) kind = "rate_change";
    if (!kind) continue;
    const iso = isoDate(ts);
    if (!iso) continue;
    const key = `${name}::${kind}`;
    const list = out.get(key) || [];
    list.push(iso);
    out.set(key, list);
  }
  // Sort each list oldest-first. The request tabs are populated in form-
  // submission order (top→bottom = oldest→newest), so popTimestamp consumes
  // them in the same order — first row in the tab gets the earliest
  // matching submission, last row gets the most recent.
  for (const [, list] of out) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return out;
}

export function classifySot(
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
  requestTimestamps?: Map<string, string[]>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Onboarding!A:R");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const out: RequestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 18);
    const status = (row[0] || "").trim();
    const name = (row[3] || "").trim();
    if (!name) continue;
    const closed = CLOSED_ONBOARDING.has(status.toLowerCase());
    const country = countries.get(canonicalName(name)) || "";
    const requestedAt = popTimestamp(requestTimestamps, canonicalName(name), "onboarding");
    out.push({
      source: "onboarding",
      requestType: "Onboarding",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(canonicalName(name)) || "",
      status,
      closed,
      requestedAt,
      startDate: isoDate(row[13]),
      endDate: isoDate(row[14]),
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
      email: (row[4] || "").trim(),
      department: (row[5] || "").trim(),
      jobTitle: (row[8] || "").trim(),
      scopeOfWork: (row[9] || "").trim(),
      paymentType: (row[10] || "").trim(),
      paymentRate: (row[11] || "").trim(),
      maxWeeklyHours: (row[12] || "").trim(),
      saasTools: (row[15] || "").trim(),
      workingLocation: (row[16] || "").trim(),
    });
  }
  return out;
}

export async function loadExtension(
  sot: SotEntry[],
  countries: Map<string, string>,
  requestTimestamps?: Map<string, string[]>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Extension!A:F");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const priorEnds = await loadPriorEndDates();
  const onboardingByName = await loadOnboardingDetailsByName();
  const sotJobTitleByName = new Map<string, string>();
  for (const e of sot) {
    if (e.jobTitle) sotJobTitleByName.set(canonicalName(e.name), e.jobTitle);
  }
  const out: RequestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 6);
    const status = (row[0] || "").trim();
    const name = (row[3] || "").trim();
    if (!name) continue;
    const closed = CLOSED_EXTENSION.has(status.toLowerCase());
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    const onbDetails = onboardingByName.get(key);
    const requestedAt = popTimestamp(requestTimestamps, key, "extension");
    out.push({
      source: "extension",
      requestType: "Extension",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      closed,
      requestedAt,
      startDate: null,
      endDate: null,
      newEndDate: isoDate(row[4]),
      priorEndDate: priorEnds.get(key) || null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
      jobTitle: sotJobTitleByName.get(key) || onbDetails?.jobTitle,
      scopeOfWork: onbDetails?.scopeOfWork,
      paymentRate: onbDetails?.paymentRate,
      scopeOrRateChanged: (row[5] || "").trim(),
    });
  }
  return out;
}

/**
 * Onboarding details keyed by contractor canonical name — used by Extension
 * to surface Job Title / Scope / Payment Rate from the original onboarding
 * row. Reads the same A:R range as `loadOnboarding`. If a person has multiple
 * onboarding rows, the last one wins (latest record).
 */
async function loadOnboardingDetailsByName(): Promise<
  Map<
    string,
    {
      jobTitle: string;
      scopeOfWork: string;
      paymentRate: string;
    }
  >
> {
  const out = new Map<
    string,
    { jobTitle: string; scopeOfWork: string; paymentRate: string }
  >();
  const rows = await readRange("Onboarding!A:R");
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 18);
    const name = (row[3] || "").trim();
    if (!name) continue;
    out.set(canonicalName(name), {
      jobTitle: (row[8] || "").trim(),
      scopeOfWork: (row[9] || "").trim(),
      paymentRate: (row[11] || "").trim(),
    });
  }
  return out;
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
  requestTimestamps?: Map<string, string[]>,
): Promise<RequestEntry[]> {
  const rows = await readRange("Offboarding!A:H");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const out: RequestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 8);
    const status = (row[0] || "").trim();
    const name = (row[3] || "").trim();
    if (!name) continue;
    const closed = CLOSED_OFFBOARDING.has(status.toLowerCase());
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    const requestedAt = popTimestamp(requestTimestamps, key, "offboarding");
    out.push({
      source: "offboarding",
      requestType: "Offboarding",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      closed,
      requestedAt,
      startDate: null,
      endDate: isoDate(row[4]),
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: null,
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
      terminationReason: (row[5] || "").trim(),
      notifiedFlag: (row[7] || "").trim(),
    });
  }
  return out;
}

export async function loadRateChange(
  sot: SotEntry[],
  countries: Map<string, string>,
  requestTimestamps?: Map<string, string[]>,
): Promise<RequestEntry[]> {
  const rows = await readRange("'Rate Change'!A:I");
  if (rows.length < 2) return [];
  const approver = approverFromSot(sot);
  const out: RequestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = pad(rows[i], 9);
    const status = (row[0] || "").trim();
    const name = (row[3] || "").trim();
    if (!name) continue;
    const closed = CLOSED_RATE_CHANGE.has(status.toLowerCase());
    const key = canonicalName(name);
    const country = countries.get(key) || "";
    const requestedAt = popTimestamp(requestTimestamps, key, "rate_change");
    out.push({
      source: "rate_change",
      requestType: "Rate Change",
      name,
      manager: (row[2] || "").trim(),
      approver: approver.get(key) || "",
      status,
      closed,
      requestedAt,
      startDate: null,
      endDate: null,
      newEndDate: null,
      priorEndDate: null,
      effectiveDate: isoDate(row[5]),
      country,
      owner: ownerFor(country),
      rowIndex: i + 1,
      newPaymentRate: (row[4] || "").trim(),
    });
  }
  return out;
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
  const [sot, countries, requestTimestamps] = await Promise.all([
    loadSot(),
    loadCountryLookup(),
    loadRequestTimestamps(),
  ]);
  const [onboarding, extension, offboarding, rateChange] = await Promise.all([
    loadOnboarding(sot, countries.byName, requestTimestamps),
    loadExtension(sot, countries.byName, requestTimestamps),
    loadOffboarding(sot, countries.byName, requestTimestamps),
    loadRateChange(sot, countries.byName, requestTimestamps),
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

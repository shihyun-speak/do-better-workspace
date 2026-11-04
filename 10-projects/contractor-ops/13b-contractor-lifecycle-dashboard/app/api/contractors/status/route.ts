import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeCell, readRange } from "@/lib/sheets";
import { canonicalName } from "@/lib/owners";
import { parseDate } from "@/lib/dates";
import { appendLog } from "@/lib/activityLog";
import { auth } from "@/auth";

type Source =
  | "onboarding"
  | "extension"
  | "offboarding"
  | "rate_change"
  | "sot";

const TAB_FOR_SOURCE: Record<Source, string> = {
  onboarding: "Onboarding",
  extension: "Extension",
  offboarding: "Offboarding",
  rate_change: "Rate Change",
  sot: "[SoT] Contractor Tracker",
};

const ALLOWED_STATUSES: Record<Source, string[]> = {
  onboarding: ["Pending", "Action Required", "Active", "Ended", "Void"],
  extension: ["Pending", "Action Required", "Active", "Void"],
  offboarding: ["Pending", "Action Required", "Completed", "Void"],
  rate_change: ["Pending", "Action Required", "Completed", "Void"],
  // SoT statuses we let humans set. Mirrors the sheet's own dropdown chip
  // set. The sheet uses "Ending soon" (lowercase 's') — handled below.
  sot: [
    "Active",
    "Onboarding",
    "Pending",
    "Action Required",
    "Ending Soon",
    "Ending soon",
    "Ended",
    "Voided",
  ],
};

// Status column letter per source (col A everywhere except SoT, where it's H).
const STATUS_COL: Record<Source, string> = {
  onboarding: "A",
  extension: "A",
  offboarding: "A",
  rate_change: "A",
  sot: "H",
};

// Column for the contractor's name (used for the row-shift safety guard).
const NAME_COL_INDEX: Record<Source, number> = {
  onboarding: 3, // col D on request tabs
  extension: 3,
  offboarding: 3,
  rate_change: 3,
  sot: 0, // col A on SoT
};

function tabRange(tab: string, cell: string): string {
  if (/[\s[]/.test(tab)) return `'${tab}'!${cell}`;
  return `${tab}!${cell}`;
}

export async function PATCH(req: Request) {
  let body: {
    source?: Source;
    rowIndex?: number;
    name?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { source, rowIndex, name, status } = body;
  if (!source || !TAB_FOR_SOURCE[source]) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }
  if (!Number.isInteger(rowIndex) || (rowIndex as number) < 2) {
    return NextResponse.json({ error: "Invalid rowIndex" }, { status: 400 });
  }
  if (!status || !ALLOWED_STATUSES[source].includes(status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ALLOWED_STATUSES[source].join(", ")}` },
      { status: 400 },
    );
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const tab = TAB_FOR_SOURCE[source];
  const nameColIndex = NAME_COL_INDEX[source];
  const statusCol = STATUS_COL[source];
  // Read enough cols to cover both the name column and the status column.
  const probeColLetter = "H";
  const probe = await readRange(
    tabRange(tab, `A${rowIndex}:${probeColLetter}${rowIndex}`),
  );
  const probeRow = probe[0] || [];
  const sheetName = (probeRow[nameColIndex] || "").trim().toLowerCase();
  if (sheetName !== name.trim().toLowerCase()) {
    return NextResponse.json(
      {
        error: `Row ${rowIndex} on ${tab} is "${probeRow[nameColIndex] || ""}", not "${name}". Refresh and try again.`,
      },
      { status: 409 },
    );
  }

  // Normalize to the casing used by the sheet's own dropdown chip — the chip
  // color won't render on the sheet side unless it's an exact-match.
  const normalized =
    source === "sot" && status === "Ending Soon" ? "Ending soon" : status;

  await writeCell(tabRange(tab, `${statusCol}${rowIndex}`), normalized);

  // Side-effect: mirror request-tab status changes into SoT Status (col H):
  //   Offboarding open (Pending/Action Required/blank) → "Ending soon"
  //   Offboarding Completed                            → "Ended"
  //   Offboarding Void                                 → no-op
  //   Onboarding  Active                               → "Active"
  //   Extension   Active                               → "Active"
  let sotSync: { rowIndex: number; status: string } | null = null;
  const sotStatusToWrite = deriveSotStatusFromRequest(source, status);
  if (sotStatusToWrite) {
    sotSync = await writeSotStatus(name, sotStatusToWrite);
  }

  // Side-effect: when Extension flips to Active, write the new end date into
  // SoT col G (End Date). When Offboarding has a non-Void status with an end
  // date earlier than current SoT End Date, write the earlier date into SoT
  // col G. Both writes overwrite a formula cell — matching the existing
  // manual workflow where SoT End Date gets typed over on extension/early
  // offboarding.
  let sotEndSync: { rowIndex: number; from: string | null; to: string } | null =
    null;
  if (source === "extension" && status === "Active") {
    // Use the LATEST Active extension end date for this contractor, not just
    // the row being clicked. This handles the case where a contractor has
    // multiple Active Extension rows (e.g. an old one from a prior cycle +
    // the new one we're approving now) — we want SoT col G to reflect the
    // final/latest extension, not whichever row happened to be flipped.
    const latestEnd = await latestActiveExtensionEndDate(name);
    if (latestEnd) {
      sotEndSync = await syncSotEndDate(name, latestEnd, "extension");
    }
  } else if (source === "offboarding" && status !== "Void") {
    const offEndRaw = (probeRow[4] || "").trim(); // Offboarding col E
    sotEndSync = await syncSotEndDate(name, offEndRaw, "offboarding");
  }

  // Automation log: record the automatic SoT side-effects (the human's own
  // status flip is the cause, shown in the action text).
  if (sotSync || sotEndSync) {
    const session = await auth();
    const trigger = `Dashboard (${session?.user?.email || "unknown"})`;
    const cause = `after ${TAB_FOR_SOURCE[source]} → ${status}`;
    await appendLog([
      ...(sotSync
        ? [{
            automation: "SoT auto-sync",
            flow: "Contractor",
            trigger,
            person: name,
            action: `SoT status → ${sotSync.status} (${cause})`,
            result: "OK" as const,
            details: `Row ${sotSync.rowIndex}`,
          }]
        : []),
      ...(sotEndSync
        ? [{
            automation: "SoT auto-sync",
            flow: "Contractor",
            trigger,
            person: name,
            action: `SoT end date: ${sotEndSync.from ?? "—"} → ${sotEndSync.to} (${cause})`,
            result: "OK" as const,
            details: `Row ${sotEndSync.rowIndex}`,
          }]
        : []),
    ]);
  }

  // Bust the read cache so the dashboard reflects the change on next load.
  revalidatePath("/");
  revalidatePath("/api/contractors");

  return NextResponse.json({
    ok: true,
    source,
    rowIndex,
    status,
    sotSync,
    sotEndSync,
  });
}

/**
 * Writes a new End Date into SoT col G if the conditions are met:
 *   - extension trigger: always write (extension was just approved).
 *   - offboarding trigger: only write if the new date is earlier than what's
 *     currently in SoT (i.e. the offboarding is shortening the contract).
 * Logs every write to SLACK_AUTH_ALERT_WEBHOOK so there's a paper trail.
 * Returns the row + before/after, or null if no write happened.
 */
async function syncSotEndDate(
  contractorName: string,
  candidateRaw: string,
  trigger: "extension" | "offboarding",
): Promise<{ rowIndex: number; from: string | null; to: string } | null> {
  const candidate = parseDate(candidateRaw);
  if (!candidate) return null;
  const candidateIso = candidate.toISOString().slice(0, 10);

  // Locate the SoT row + read its current col G value.
  const sotRows = await readRange("'[SoT] Contractor Tracker'!A2:G");
  const target = canonicalName(contractorName);
  let sotRowIndex = -1;
  let currentEndIso: string | null = null;
  for (let i = 0; i < sotRows.length; i++) {
    const row = sotRows[i] || [];
    const cell = (row[0] || "").trim();
    if (cell && canonicalName(cell) === target) {
      sotRowIndex = i + 2;
      const parsedCurrent = parseDate(row[6]);
      currentEndIso = parsedCurrent
        ? parsedCurrent.toISOString().slice(0, 10)
        : null;
      break;
    }
  }
  if (sotRowIndex === -1) return null;

  // Offboarding only updates SoT if it shortens the contract.
  if (trigger === "offboarding" && currentEndIso && candidateIso >= currentEndIso) {
    return null;
  }
  // No-op if the date isn't actually changing.
  if (currentEndIso === candidateIso) return null;

  // Write as MM/DD/YYYY — matches how the sheet displays dates and how a
  // human would type it in.
  const mm = String(candidate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(candidate.getUTCDate()).padStart(2, "0");
  const yyyy = candidate.getUTCFullYear();
  const displayDate = `${mm}/${dd}/${yyyy}`;

  await writeCell(`'[SoT] Contractor Tracker'!G${sotRowIndex}`, displayDate);

  // Audit log: best-effort post to Slack. Don't let webhook failure break
  // the response — the write already succeeded.
  postSlackAudit(
    `🗓 Auto-synced SoT End Date for *${contractorName}* (row ${sotRowIndex}): ${currentEndIso ?? "—"} → ${candidateIso} (trigger: ${trigger})`,
  ).catch(() => {});

  return { rowIndex: sotRowIndex, from: currentEndIso, to: candidateIso };
}

/**
 * Read all Extension rows and return the latest New End Date among the rows
 * marked Active that belong to the given contractor (matched by canonical
 * name). Returns the raw date string (as it appears in the sheet) so the
 * existing parseDate path handles "May 12, 2026", "5/12/2026", etc.
 */
async function latestActiveExtensionEndDate(
  contractorName: string,
): Promise<string | null> {
  const rows = await readRange("Extension!A:E");
  const target = canonicalName(contractorName);
  let bestIso: string | null = null;
  let bestRaw: string | null = null;
  for (const row of rows.slice(1)) {
    const status = (row[0] || "").trim().toLowerCase();
    if (status !== "active") continue;
    const name = (row[3] || "").trim();
    if (canonicalName(name) !== target) continue;
    const raw = (row[4] || "").trim();
    if (!raw) continue;
    const parsed = parseDate(raw);
    if (!parsed) continue;
    const iso = parsed.toISOString().slice(0, 10);
    if (!bestIso || iso > bestIso) {
      bestIso = iso;
      bestRaw = raw;
    }
  }
  return bestRaw;
}

async function postSlackAudit(text: string): Promise<void> {
  const url = process.env.SLACK_AUTH_ALERT_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

/**
 * Map a request-tab status change to the SoT Status we want to display, or
 * null if no SoT write should happen.
 *
 *   Offboarding  Completed                         → "Ended"
 *   Offboarding  Pending/Action Required/blank     → "Ending soon"
 *   Offboarding  Void                              → no-op
 *   Onboarding   Active                            → "Active"
 *   Extension    Active                            → "Active"
 *   Anything else                                  → no-op
 */
function deriveSotStatusFromRequest(
  source: Source,
  reqStatus: string,
): string | null {
  const s = reqStatus.trim().toLowerCase();
  if (source === "offboarding") {
    if (s === "completed") return "Ended";
    if (s === "void" || s === "voided") return null;
    return "Ending soon"; // Pending / Action Required / blank
  }
  if ((source === "onboarding" || source === "extension") && s === "active") {
    return "Active";
  }
  return null;
}

/**
 * Find the contractor's SoT row by canonical name and write the given status
 * into col H. Returns null if the contractor isn't in SoT.
 */
async function writeSotStatus(
  contractorName: string,
  sotStatus: string,
): Promise<{ rowIndex: number; status: string } | null> {
  const sotRows = await readRange("'[SoT] Contractor Tracker'!A2:A");
  const target = canonicalName(contractorName);
  let sotRowIndex = -1;
  for (let i = 0; i < sotRows.length; i++) {
    const cell = (sotRows[i]?.[0] || "").trim();
    if (cell && canonicalName(cell) === target) {
      sotRowIndex = i + 2; // +2 because we started reading at A2
      break;
    }
  }
  if (sotRowIndex === -1) return null;

  await writeCell(`'[SoT] Contractor Tracker'!H${sotRowIndex}`, sotStatus);
  return { rowIndex: sotRowIndex, status: sotStatus };
}

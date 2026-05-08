import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeCell, readRange } from "@/lib/sheets";

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

  // Bust the read cache so the dashboard reflects the change on next load.
  revalidatePath("/");
  revalidatePath("/api/contractors");

  return NextResponse.json({ ok: true, source, rowIndex, status });
}

import { loadSot } from "./parsers";
import { writeCell } from "./sheets";

/**
 * Daily reconciliation: bring SoT col H in line with what the dashboard's
 * classifier already shows. Two flips:
 *
 *   Active        + end date within 10 working days  →  "Ending soon"
 *   "Ending soon" + end date pushed out past 10 days →  "Active"
 *
 * Designed to run from a Vercel cron once per day, shortly before the 9am KST
 * contractor-reminder digest. Silent — no Slack message; the digest is the
 * visibility layer.
 *
 * Rows are evaluated by `loadSot`'s classifier so the same business rules
 * that drive the UI also drive the write. We never touch rows that classify
 * as Onboarding, Inactive (Ended/Voided/Data error/Expired) — those are
 * either human-managed or terminal.
 */

export type ReconcileResult = {
  scanned: number;
  flipped: {
    rowIndex: number;
    name: string;
    from: string;
    to: string;
  }[];
  errors: { rowIndex: number; name: string; message: string }[];
};

export async function reconcileSotStatus(): Promise<ReconcileResult> {
  const entries = await loadSot();
  const flipped: ReconcileResult["flipped"] = [];
  const errors: ReconcileResult["errors"] = [];

  for (const e of entries) {
    const raw = e.rawStatus.trim();
    const rawLower = raw.toLowerCase();

    let target: string | null = null;

    // Forward flip: classifier says ending_soon but cell isn't already
    // "Ending soon" (case-insensitive — sheet uses lowercase 's').
    if (e.lifecycle === "ending_soon" && rawLower !== "ending soon") {
      target = "Ending soon";
    }

    // Reverse flip: classifier says active but cell still reads "Ending
    // soon" (i.e. an extension pushed the end date past the 10-day window).
    // We do NOT auto-flip away from manual statuses like "Onboarding" or
    // "Action Required" — only the auto-set "Ending soon" gets cleared.
    if (e.lifecycle === "active" && rawLower === "ending soon") {
      target = "Active";
    }

    if (!target) continue;

    try {
      await writeCell(
        `'[SoT] Contractor Tracker'!H${e.rowIndex}`,
        target,
      );
      flipped.push({
        rowIndex: e.rowIndex,
        name: e.name,
        from: raw || "—",
        to: target,
      });
    } catch (err) {
      errors.push({
        rowIndex: e.rowIndex,
        name: e.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { scanned: entries.length, flipped, errors };
}

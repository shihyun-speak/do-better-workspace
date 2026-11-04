import { getAccessToken } from "./auth";

/**
 * Automation log: one row per automation run / action, in a separate
 * "POps Automation Log" sheet (not the contractor Sheet). Read by the
 * dashboard's Activity tab.
 *
 * Kill switch: set ACTIVITY_LOG_SHEET_ID=off to stop all writes (and hide
 * entries) without touching the automations themselves.
 *
 * Writes are best-effort: a logging failure never breaks the automation
 * that called it.
 */

export const LOG_SHEET_ID =
  process.env.ACTIVITY_LOG_SHEET_ID || "1okDnmzfjdHYwQJSCKIfO-H0VYx56Q_7frPpGc0bDzck";
const LOG_RANGE = "Log!A:H";

export function activityLogEnabled(): boolean {
  return LOG_SHEET_ID !== "off";
}

export type LogResult = "OK" | "Failed" | "Skipped";

export type LogEntry = {
  timestamp: string; // ISO, UTC
  automation: string; // e.g. "SoT status sync"
  flow: string; // "Contractor" | "Onboarding" | "Offboarding"
  trigger: string; // "Schedule" | "Dashboard (<email>)" | "Manual"
  person: string; // contractor / employee name, or "" for run summaries
  action: string; // what happened, human-readable
  result: LogResult;
  details: string;
};

export async function appendLog(
  entries: Omit<LogEntry, "timestamp">[],
): Promise<void> {
  if (!activityLogEnabled() || entries.length === 0) return;
  const now = new Date().toISOString();
  try {
    const token = await getAccessToken("write");
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${LOG_SHEET_ID}/values/` +
      `${encodeURIComponent(LOG_RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: entries.map((e) => [
          now,
          e.automation,
          e.flow,
          e.trigger,
          e.person,
          e.action,
          e.result,
          e.details,
        ]),
      }),
    });
    if (!res.ok) {
      console.error(`Activity log append failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Activity log append failed:", err);
  }
}

/** Newest first, capped at `limit` rows. */
export async function readLog(limit = 500): Promise<LogEntry[]> {
  if (!activityLogEnabled()) return [];
  const token = await getAccessToken("read");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${LOG_SHEET_ID}/values/` +
    `${encodeURIComponent("Log!A2:H")}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Activity log read failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return (data.values || [])
    .filter((r) => r[0])
    .map((r) => ({
      timestamp: r[0] || "",
      automation: r[1] || "",
      flow: r[2] || "",
      trigger: r[3] || "",
      person: r[4] || "",
      action: r[5] || "",
      result: ((r[6] || "OK") as LogResult),
      details: r[7] || "",
    }))
    .reverse()
    .slice(0, limit);
}

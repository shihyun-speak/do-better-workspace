import { getAccessToken } from "./auth";
import { LOG_SHEET_ID } from "./activityLog";

/**
 * Checklist ticks for request action plans, stored in the "Steps" tab of the
 * POps Automation Log sheet (never the contractor Sheet). Append-only: each
 * tick / untick is a new row, and the latest row per (request, step) wins,
 * so the tab doubles as the history of who did what.
 *
 * Columns: Updated at (UTC) | Request key | Type | Contractor | Step | Done | Updated by
 */

const RANGE = "Steps!A:G";

/** requestKey → stepId → done */
export type StepState = Record<string, Record<string, boolean>>;

export async function readSteps(): Promise<StepState> {
  if (LOG_SHEET_ID === "off") return {};
  const token = await getAccessToken("read");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${LOG_SHEET_ID}/values/` +
    `${encodeURIComponent("Steps!A2:G")}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Steps read failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const state: StepState = {};
  // Rows are in append order, so later rows overwrite earlier ones.
  for (const row of data.values || []) {
    const [, key, , , step, done] = row;
    if (!key || !step) continue;
    (state[key] ||= {})[step] = (done || "").toUpperCase() === "TRUE";
  }
  return state;
}

export async function writeStep(entry: {
  key: string;
  type: string;
  contractor: string;
  step: string;
  done: boolean;
  by: string;
}): Promise<void> {
  if (LOG_SHEET_ID === "off") throw new Error("Steps storage is turned off");
  const token = await getAccessToken("write");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${LOG_SHEET_ID}/values/` +
    `${encodeURIComponent(RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [[
        new Date().toISOString(),
        entry.key,
        entry.type,
        entry.contractor,
        entry.step,
        entry.done ? "TRUE" : "FALSE",
        entry.by,
      ]],
    }),
  });
  if (!res.ok) {
    throw new Error(`Steps write failed: ${res.status} ${await res.text()}`);
  }
}

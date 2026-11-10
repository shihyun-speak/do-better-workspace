import { getAccessToken } from "./auth";

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM";

export async function readRange(rangeStr: string): Promise<string[][]> {
  const token = await getAccessToken("read");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/` +
    `${encodeURIComponent(rangeStr)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Always fresh (2026-11-10): people edit the Sheet directly, and a 60s
    // cache made Open items / Roster lag behind it. Also keeps the write
    // route's name-vs-row probe honest.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Sheets API error for ${rangeStr}: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values || [];
}

export async function writeCell(rangeStr: string, value: string): Promise<void> {
  const token = await getAccessToken("write");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/` +
    `${encodeURIComponent(rangeStr)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) {
    throw new Error(
      `Sheets write error for ${rangeStr}: ${res.status} ${await res.text()}`,
    );
  }
}

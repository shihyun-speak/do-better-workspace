// Shared helpers for the "To log" API routes (not a route itself: Vercel skips files starting with _).
import { timingSafeEqual } from 'node:crypto';

export const NOTION_API = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';
export const RAMP_TAG = 'Ramp:'; // prefix written into 비고 so a Ramp charge is never logged twice

// ── Auth ────────────────────────────────────────────────
// The page sends the passcode in the x-log-passcode header. Every write/read of card data checks it.
export function checkPasscode(req, res) {
  const expected = process.env.LOG_PASSCODE;
  if (!expected) {
    res.status(500).json({ error: 'LOG_PASSCODE is not configured on the server' });
    return false;
  }
  const given = String(req.headers['x-log-passcode'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Wrong passcode' });
    return false;
  }
  return true;
}

// ── Notion ──────────────────────────────────────────────
export async function notion(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Notion ${r.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

export async function queryAll(dbId, filter) {
  let rows = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const data = await notion(`/databases/${dbId}/query`, { method: 'POST', body });
    rows = rows.concat(data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return rows;
}

// Ramp transaction IDs already written to the snack DB (found in 비고).
export async function loggedRampIds() {
  const rows = await queryAll(process.env.NOTION_SNACK_DB_ID, {
    property: '비고',
    rich_text: { contains: RAMP_TAG },
  });
  const ids = new Set();
  for (const r of rows) {
    const note = (r.properties['비고']?.rich_text || []).map(t => t.plain_text).join('');
    const m = note.match(/Ramp:([A-Za-z0-9-]+)/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

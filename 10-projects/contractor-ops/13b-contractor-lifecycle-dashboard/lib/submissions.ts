import { readRange } from "./sheets";
import { canonicalName } from "./owners";
import { isoDate, parseDate } from "./dates";
import type { RequestSource } from "./parsers";

/**
 * Every answer a contractor's forms submitted, straight from the
 * "Form Responses" tab (the request tabs only copy some of them). Used by
 * the profile panel. Empty answers and unused "Column N" headers are dropped.
 */

const TYPE_BY_ANSWER: Record<string, RequestSource> = {
  "onboarding a new contractor": "onboarding",
  "current contractor extension": "extension",
  "offboarding a current contractor": "offboarding",
  "current contractor payment rate change": "rate_change",
};

// Columns that are shown elsewhere in the card, or are renamed for clarity.
const SKIP = new Set(["timestamp", "contractor's full name", "what type of request is this?"]);
const RENAME: Record<string, string> = {
  "your name": "Submitted by",
  "email address": "Submitter email",
};

export type Submission = {
  submittedAt: string | null; // ISO date, matches RequestEntry.requestedAt
  type: RequestSource | null;
  typeLabel: string;
  fields: [string, string][];
};

export async function loadSubmissions(name: string): Promise<Submission[]> {
  const rows = await readRange("'Form Responses'!A1:AZ");
  if (rows.length < 2) return [];
  const headers = rows[0];
  const target = canonicalName(name);
  const out: Submission[] = [];
  for (const row of rows.slice(1)) {
    if (canonicalName(row[3]) !== target) continue;
    const typeLabel = (row[4] || "").trim();
    const fields: [string, string][] = [];
    headers.forEach((h, i) => {
      const header = (h || "").trim();
      const value = (row[i] || "").trim();
      if (!value || !header || /^column \d+$/i.test(header) || SKIP.has(header.toLowerCase())) return;
      fields.push([RENAME[header.toLowerCase()] || header, value]);
    });
    out.push({
      submittedAt: isoDate(parseDate(row[0])),
      type: TYPE_BY_ANSWER[typeLabel.toLowerCase()] || null,
      typeLabel,
      fields,
    });
  }
  return out.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
}

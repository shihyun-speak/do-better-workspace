/**
 * Real-time new-contractor-request alert.
 *
 * Triggered by Google Form submission. Reads the just-submitted row from
 * the "Form Responses" sheet and posts to the Contractor Bot Slack
 * webhook. Replaces the abandoned every-30-min polling path so we don't
 * depend on GitHub Actions cron reliability.
 *
 * Setup (one-time):
 *   1. Open the Google Sheet (1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM)
 *   2. Extensions → Apps Script
 *   3. Paste this file in
 *   4. Project Settings → Script properties → add SLACK_WEBHOOK_CHANNEL
 *      with the same webhook URL the GitHub Action uses
 *   5. Triggers (clock icon) → Add Trigger:
 *        function: onFormSubmit
 *        event source: From spreadsheet
 *        event type: On form submit
 *   6. Authorize when prompted
 *
 * Form Responses columns (0-indexed for e.values):
 *    0 A  Timestamp
 *    1 B  Your Name (submitter)
 *    2 C  Manager Name
 *    3 D  Contractor's Full Name
 *    4 E  Request type
 *    7 H  Country of Residence (or US State)
 *   14 O  Start Date         (onboarding)
 *   15 P  End Date            (onboarding)
 *   19 T  New End Date        (extension)
 *   22 W  Effective Date      (rate change)
 *   27 AB End Date            (offboarding)
 *   28 AC Original End Date   (offboarding, if different)
 */

const FORM_RESPONSES_SHEET = 'Form Responses';
const SOT_SHEET = '[SoT] Contractor Tracker';

// Column indices into e.values (0-based).
const COL = {
  TIMESTAMP: 0,
  SUBMITTER: 1,
  MANAGER: 2,
  NAME: 3,
  REQ_TYPE: 4,
  COUNTRY: 7,
  ONBOARD_START: 14,
  ONBOARD_END: 15,
  EXTENSION_NEW_END: 19,
  RATE_EFFECTIVE: 22,
  OFFBOARD_END: 27,
  OFFBOARD_ORIG_END: 28,
};

// --- Owner routing (mirrors APAC_COUNTRIES + owner_tag in contractor_reminder.py) ---

const APAC_COUNTRIES = [
  'japan', 'korea', 'south korea', 'republic of korea',
  'taiwan', 'singapore', 'hong kong', 'china', 'philippines',
  'vietnam', 'thailand', 'indonesia', 'malaysia', 'india',
  'australia', 'new zealand',
];

const SHIHYUN_ID = 'U08336ST4HK';  // APAC
const HEMMI_ID   = 'U08EJGRKP50';  // US + RoW

function ownerTag_(country) {
  const c = String(country || '').trim().toLowerCase();
  if (!c) return `<@${SHIHYUN_ID}> / <@${HEMMI_ID}>`;  // unknown → tag both
  for (const apac of APAC_COUNTRIES) {
    if (c.indexOf(apac) !== -1) return `<@${SHIHYUN_ID}>`;
  }
  return `<@${HEMMI_ID}>`;
}

// --- Submitter/manager Slack ID lookup (mirrors SLACK_IDS in contractor_reminder.py) ---

const SLACK_IDS = {
  'colton gyulay': 'U56JF6RMZ',
  'colton': 'U56JF6RMZ',
  'connor / colton': 'U56JF6RMZ',
  'khunal parkash': 'U04TA8X3ZPV',
  'khunal': 'U04TA8X3ZPV',
  'charlene xiong': 'U025HSRU1SA',
  'charlene (ying) xiong': 'U025HSRU1SA',
  'charlen xiong': 'U025HSRU1SA',
  'charlene': 'U025HSRU1SA',
  'oj': 'U08QUHJ9JEA',
  'oj osborne-jones': 'U08QUHJ9JEA',
  'alexandra osborne - jones (in her absence pass on to colton)': 'U08QUHJ9JEA',
  'alexandra oj (since she is out, you can reach out to colton)': 'U08QUHJ9JEA',
  'alexandra osborn-jones': 'U08QUHJ9JEA',
  'audrey': 'URHQ7HXFB',
  'yan kindyushenko': 'U0462LK49CG',
  'yan': 'U0462LK49CG',
  'minjeong kim': 'U09BCRN3FMH',
  'minjeong': 'U09BCRN3FMH',
  'kai hansen': 'U0AJUBJ0KRB',
  'katya hadjipetkova': 'U07PKRRB1MH',
  'katya': 'U07PKRRB1MH',
  'ekaterina hadjipetkova': 'U07PKRRB1MH',
  'ekaterina hadjipetkova (katya)': 'U07PKRRB1MH',
  'sunjae lee': 'U07PHUDU9DK',
  'sunjae': 'U07PHUDU9DK',
};

function fmtPerson_(name) {
  if (!name) return '';
  const key = String(name).trim().toLowerCase();
  const uid = SLACK_IDS[key];
  return uid ? `<@${uid}>` : String(name).trim();
}

// --- Date formatting ---

function fmtDate_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, 'MMM d, yyyy');
  }
  // String fallback — try parsing a few common formats, else echo as-is.
  const s = String(v).trim();
  if (!s) return '';
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    return Utilities.formatDate(d, tz, 'MMM d, yyyy');
  }
  return s;
}

// --- SoT lookup for extension's previous end date ---

function lookupSotEndDate_(name) {
  if (!name) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SOT_SHEET);
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return '';
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const nameCol = header.indexOf('contractor name');
  const endCol = header.indexOf('end date');
  if (nameCol < 0 || endCol < 0) return '';
  const target = String(name).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][nameCol] || '').trim().toLowerCase() === target) {
      return data[i][endCol];
    }
  }
  return '';
}

// --- Date lines per request type ---

function dateLinesFor_(reqType, row, contractorName) {
  const t = String(reqType || '').trim().toLowerCase();
  const lines = [];

  // Onboarding: form has Start Date + End Date on the row.
  if (t.indexOf('onboard') !== -1) {
    const start = fmtDate_(row[COL.ONBOARD_START]);
    const end = fmtDate_(row[COL.ONBOARD_END]);
    if (start && end) lines.push(`>Contract period: \`${start}\` → \`${end}\``);
    else if (start) lines.push(`>Starts \`${start}\``);
    else if (end) lines.push(`>Ends \`${end}\``);
    return lines;
  }

  // Extension: form has New End Date; previous end date comes from SoT.
  if (t.indexOf('extension') !== -1 || t.indexOf('extend') !== -1) {
    const newEnd = fmtDate_(row[COL.EXTENSION_NEW_END]);
    const prev = fmtDate_(lookupSotEndDate_(contractorName));
    if (newEnd && prev) lines.push(`>Current end date \`${prev}\` → new end date \`${newEnd}\``);
    else if (newEnd) lines.push(`>New end date \`${newEnd}\``);
    return lines;
  }

  // Offboarding: form has End Date + (optional) Original End Date if different.
  if (t.indexOf('offboard') !== -1 || t.indexOf('termination') !== -1 || t.indexOf('end of contract') !== -1) {
    const end = fmtDate_(row[COL.OFFBOARD_END]);
    const orig = fmtDate_(row[COL.OFFBOARD_ORIG_END]);
    if (end && orig) lines.push(`>Ends \`${end}\` (originally \`${orig}\`)`);
    else if (end) lines.push(`>Ends \`${end}\``);
    return lines;
  }

  // Rate change: form has Effective Date.
  if (t.indexOf('rate') !== -1 || t.indexOf('payment') !== -1) {
    const eff = fmtDate_(row[COL.RATE_EFFECTIVE]);
    if (eff) lines.push(`>Effective \`${eff}\``);
    return lines;
  }

  return lines;
}

// --- Trigger entrypoint ---

function onFormSubmit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== FORM_RESPONSES_SHEET) return;

  const row = e.values || [];
  const submitter = row[COL.SUBMITTER] || '';
  const manager   = row[COL.MANAGER] || '';
  const name      = (row[COL.NAME] || '').trim();
  const reqType   = (row[COL.REQ_TYPE] || '').trim() || 'Unknown';
  const country   = (row[COL.COUNTRY] || '').trim();

  if (!name) return;  // malformed submission — bail rather than post garbage

  const tag = ownerTag_(country);
  const countrySuffix = country ? ' `' + country + '`' : '';

  const lines = [
    '🆕 *New Contractor Request*',
    '',
    `>*${name}*${countrySuffix}`,
    `>${reqType} — Managed by ${fmtPerson_(manager)} — ${tag}`,
  ];

  // Date context per request type.
  const dateLines = dateLinesFor_(reqType, row, name);
  for (const dl of dateLines) lines.push(dl);

  if (submitter) lines.push(`>Submitted by ${fmtPerson_(submitter)}`);

  postToSlack_(lines.join('\n'));
}

// --- Slack sender ---

function postToSlack_(text) {
  const url = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_CHANNEL');
  if (!url) throw new Error('SLACK_WEBHOOK_CHANNEL script property not set');
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text }),
    muteHttpExceptions: true,
  });
}

// --- Manual test helper ---
//
// Run from the Apps Script editor (function dropdown → testWithLastRow → ▶ Run)
// to verify the webhook + owner routing + date rendering against the most
// recent existing row, without submitting a real form.
function testWithLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORM_RESPONSES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No rows in Form Responses to test with.');
    return;
  }
  const values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  onFormSubmit({ range: sheet.getRange(lastRow, 1), values: values });
}

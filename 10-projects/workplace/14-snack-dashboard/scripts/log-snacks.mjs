// Save one approved receipt to the Notion snack DB (one row per item), then move the receipt to receipts/logged/.
//
// Usage (from the project folder):
//   node --env-file=.env scripts/log-snacks.mjs <purchase.json> [--dry-run] [--force]
//
// purchase.json:
//   { "receipt": "receipts/inbox/IMG_1234.png",   // optional; moved to receipts/logged/ after saving
//     "date": "2026-11-12", "vendor": "쿠팡", "event": "Office Snacks",
//     "note": "optional, goes in 비고",
//     "items": [ { "name": "신쫄이 딸기맛", "price": 16200 }, ... ] }
//
// --dry-run  validate + duplicate check only, write nothing
// --force    save even if possible duplicates were found
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { notion, queryAll } from '../api/_lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const DB = process.env.NOTION_SNACK_DB_ID;

function fail(msg) { console.error(`ERROR: ${msg}`); process.exit(1); }
if (!file) fail('pass the purchase JSON file');
if (!process.env.NOTION_TOKEN || !DB) fail('run with --env-file=.env (NOTION_TOKEN, NOTION_SNACK_DB_ID)');

const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const items = (p.items || [])
  .map(i => ({ name: String(i.name || '').trim(), price: Math.round(Number(i.price)) }))
  .filter(i => i.name && Number.isFinite(i.price));
if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) fail('date must be YYYY-MM-DD');
if (!items.length) fail('no items with a name and price');

// Vendor and Event must be existing options so the dashboard groups them correctly.
const schema = await notion(`/databases/${DB}`);
const vendors = schema.properties['구매처'].select.options.map(o => o.name);
const events = schema.properties['Event'].multi_select.options.map(o => o.name);
if (!vendors.includes(p.vendor)) fail(`vendor "${p.vendor}" is not one of: ${vendors.join(', ')}`);
if (!events.includes(p.event)) fail(`event "${p.event}" is not one of: ${events.join(', ')}`);

// Duplicate check: rows on the same date with the same item name.
const sameDay = await queryAll(DB, { property: '구매일', date: { equals: p.date } });
const norm = s => s.replace(/\s+/g, '').toLowerCase();
const existing = sameDay.map(r => norm((r.properties['상품명'].title || []).map(t => t.plain_text).join('')));
// exact match, or the item appears inside a combined row like "하늘보리, 슈가로로 코코제로"
const dupes = items.filter(i => existing.some(e => e === norm(i.name) || e.includes(norm(i.name))));

const total = items.reduce((s, i) => s + i.price, 0);
console.log(`${p.date} | ${p.vendor} | ${p.event} | ${items.length} items | total ${total.toLocaleString('ko-KR')}원`);
if (dupes.length) {
  console.log(`POSSIBLE DUPLICATES already in Notion on ${p.date}: ${dupes.map(d => d.name).join(', ')}`);
  if (!force && !dryRun) fail('not saved; re-run with --force if these are new purchases');
}
if (dryRun) { console.log('DRY RUN: nothing written'); process.exit(0); }

for (const item of items) {
  const properties = {
    '상품명': { title: [{ text: { content: item.name.slice(0, 200) } }] },
    '가격': { number: item.price },
    '구매일': { date: { start: p.date } },
    '구매처': { select: { name: p.vendor } },
    'Event': { multi_select: [{ name: p.event }] },
  };
  if (p.note) properties['비고'] = { rich_text: [{ text: { content: String(p.note).slice(0, 500) } }] };
  await notion('/pages', { method: 'POST', body: { parent: { database_id: DB }, properties } });
  console.log(`  saved: ${item.name} ${item.price.toLocaleString('ko-KR')}원`);
}

if (p.receipt) {
  const src = path.resolve(ROOT, p.receipt);
  if (fs.existsSync(src)) {
    const dest = path.join(ROOT, 'receipts/logged', `${p.date}_${p.vendor}_${path.basename(src)}`);
    fs.renameSync(src, dest);
    console.log(`  moved receipt -> ${path.relative(ROOT, dest)}`);
  }
}
console.log(`DONE: ${items.length} rows added`);

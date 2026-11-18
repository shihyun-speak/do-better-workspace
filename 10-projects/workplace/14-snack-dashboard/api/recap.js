// Monthly 정산 posts to #happy-nyam-nyam via the nyam request bot (SLACK_SNACK_WEBHOOK).
// Vercel Cron calls this Mon + Fri 10:00 KST (one cron, because the Hobby plan allows only 2 and restock uses the other):
//   - 4th Monday of the month (day 22-28): short reminder that tags Shihyun to log remaining receipts
//   - Friday of that same week: the month recap (spend, hottest items, new items)
// Any other day it does nothing.
//
//   GET /api/recap?dry=1&kind=reminder|recap                     -> preview, do not post
//   GET /api/recap?force=1&kind=reminder|recap + x-log-passcode  -> post now (testing)
import { queryAll } from './_lib.js';

const BUDGET = 1_500_000; // keep in sync with CONFIG.BUDGET in shared.js
const SITE = 'https://happy-nyam-nyam.vercel.app';
const MENTION = '<@U08336ST4HK>'; // Shihyun (same ID the contractor reminder bot uses)
const ALIASES = { '만다린': '감귤', '제주감귤': '감귤', '루이보스차': '루이보스', '그릭요거트': '요거트', '요거톡': '요거트' };
const SKIP = /스낵24|대량|주문|구매|추가|정산|이용|이것저것|배송비|할인|happy hour|new hire|finance|bi-weekly/i;
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');

// A KST calendar date as plain parts
function kstDate(ms) {
  const d = new Date(ms + 9 * 3600e3);
  return { ms, iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), weekday: d.getUTCDay(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}
const isFourthMonday = (d) => d.weekday === 1 && d.day >= 22 && d.day <= 28;

// What to post today, and for which month
function plan(now) {
  if (isFourthMonday(now)) return { kind: 'reminder', month: now };
  if (now.weekday === 5) {
    const monday = kstDate(now.ms - 4 * DAY);
    if (isFourthMonday(monday)) return { kind: 'recap', month: monday }; // may already be next month; recap the Monday's month
  }
  return null;
}

function parse(row) {
  const p = row.properties || {};
  const events = (p['Event']?.multi_select || []).map(e => e.name);
  if (p['Event']?.select?.name) events.push(p['Event'].select.name);
  return {
    name: (p['상품명']?.title || []).map(t => t.plain_text || '').join('').trim(),
    date: p['구매일']?.date?.start || '',
    price: p['가격']?.number || 0,
    office: events.includes('Office Snacks'),
  };
}

function keys(name) {
  return name.split(',').map(s => s.trim()).filter(s => s && !SKIP.test(s))
    .map(s => { const k = s.replace(/\s+/g, ' ').replace(/[,.\s]+$/, '').slice(0, 25); return ALIASES[k] || k; })
    .filter(k => k.length >= 2);
}

function monthStats(rows, month, now) {
  const m = month.month + 1;
  const start = `${month.year}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  const monthEnd = `${month.year}-${pad(m)}-${pad(lastDay)}`;
  const end = now.iso < monthEnd ? now.iso : monthEnd;
  const daysLeft = now.iso < monthEnd ? lastDay - now.day + 1 : 0;

  const all = rows.map(parse).filter(r => r.name && r.date);
  const thisMonth = all.filter(r => r.office && r.date >= start && r.date <= end);
  const spent = thisMonth.reduce((s, r) => s + r.price, 0);

  const freq = {};
  thisMonth.forEach(r => keys(r.name).forEach(k => { freq[k] = (freq[k] || 0) + 1; }));
  const hottest = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const firstSeen = {};
  all.forEach(r => keys(r.name).forEach(k => { if (!firstSeen[k] || r.date < firstSeen[k]) firstSeen[k] = r.date; }));
  // newest first, 5 most recent
  const fresh = Object.keys(freq).filter(k => firstSeen[k] >= start).sort((x, y) => firstSeen[y].localeCompare(firstSeen[x])).slice(0, 5);

  return { m, endDay: Number(end.slice(8)), spent, pct: Math.round((spent / BUDGET) * 100), left: BUDGET - spent, daysLeft, orders: thisMonth.length, hottest, fresh };
}

const button = (text, url, primary) => ({ type: 'button', text: { type: 'plain_text', text, emoji: true }, url, ...(primary ? { style: 'primary' } : {}) });

// Returns Slack Block Kit blocks plus a plain `text` fallback (used for notifications and previews)
export function buildMessage(kind, rows, month, now) {
  const s = monthStats(rows, month, now);
  const monthName = new Date(Date.UTC(month.year, month.month, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  if (kind === 'reminder') {
    const text = `🧾 Time to close out ${monthName}!`;
    return {
      text,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `${MENTION} Please log any remaining receipts before Friday's recap.` } },
        { type: 'actions', elements: [button('🧾 Log your receipts', `${SITE}/log.html`, true)] },
      ],
      stats: s,
    };
  }

  const mood = s.pct > 100 ? 'Over Budget! 🚨' : s.pct >= 70 ? 'Budget Tight 👀' : 'Budget Safe! 🟢';
  const hot = s.hottest.length ? s.hottest.map(([k, n], i) => `${i + 1}. ${k}  _${n}x_`).join('\n') : '_None yet_';
  const fresh = s.fresh.length ? s.fresh.map(k => `• ${k}`).join('\n') : '_None yet_';
  const text = `🧾 ${monthName} Snack Recap: ${mood}`;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `🧾 ${monthName} Snack Recap: ${mood}`, emoji: true } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `*🔥 Most popular*\n${hot}` },
      { type: 'mrkdwn', text: `*✨ New this month*\n${fresh}` },
    ] },
  ];
  if (!s.orders) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'No Office Snacks logged this month. Any receipts hiding somewhere?' }] });
  blocks.push({ type: 'actions', elements: [button('📊 See dashboard', SITE)] });
  return { text, blocks, stats: s };
}

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://local').searchParams;
  const dry = q.get('dry') === '1';
  const force = q.get('force') === '1';
  if (force && (!process.env.LOG_PASSCODE || req.headers['x-log-passcode'] !== process.env.LOG_PASSCODE)) {
    return res.status(401).json({ error: 'force needs the passcode header' });
  }

  const now = kstDate(Date.now());
  let todo = plan(now);
  if ((dry || force) && ['reminder', 'recap'].includes(q.get('kind'))) todo = { kind: q.get('kind'), month: todo?.month || now };
  if (!todo) return res.status(200).json({ ok: true, posted: false, reason: `nothing scheduled for ${now.iso}` });

  try {
    const rows = await queryAll(process.env.NOTION_SNACK_DB_ID);
    const msg = buildMessage(todo.kind, rows, todo.month, now);
    if (dry) return res.status(200).json({ ok: true, posted: false, dry: true, kind: todo.kind, ...msg });

    const webhook = process.env.SLACK_SNACK_WEBHOOK;
    if (!webhook) return res.status(500).json({ error: 'SLACK_SNACK_WEBHOOK not configured' });
    const r = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg.text, blocks: msg.blocks }) });
    if (!r.ok) return res.status(500).json({ error: `Slack error: ${await r.text()}` });
    return res.status(200).json({ ok: true, posted: true, kind: todo.kind });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_SNACK_DB_ID = process.env.NOTION_SNACK_DB_ID;
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Item-name variants that should count as the same product.
// variant -> canonical name
const ALIASES = {
  '만다린': '감귤',
  '루이보스차': '루이보스',
  '그릭요거트': '요거트',
  '요거톡': '요거트',
};

// Non-item rows (bulk-order/settlement lines, event names) to ignore.
const SKIP = /스낵24|대량|주문|구매|추가|정산|이용|이것저것|happy hour|new hire|finance|bi-weekly/i;

const DAY = 24 * 60 * 60 * 1000;
// Each week, remind about what was ordered in the same week ~1 month ago.
// Window = [run - 35d, run - 28d): the 7-day span sitting four weeks back.
const LOOKBACK_FAR_DAYS = 35;
const LOOKBACK_NEAR_DAYS = 28;
const TOP_N = 7; // show the 7 most-frequently-ordered items from that week; drop the tail

function canon(key) {
  return ALIASES[key] || key;
}

async function fetchAllRows() {
  let all = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`${NOTION_API}/databases/${NOTION_SNACK_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Notion API error: ${await r.text()}`);
    const data = await r.json();
    all = all.concat(data.results);
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }
  return all;
}

// Items ordered in the corresponding week ~1 month before `runDate`,
// ranked by all-time order frequency (most-bought staples first) and
// capped at TOP_N. Anchored to the calendar, so the list changes weekly.
function itemsFromWeekLastMonth(rows, runDate) {
  const runMs = new Date(runDate).getTime();
  const start = new Date(runMs - LOOKBACK_FAR_DAYS * DAY).toISOString().substring(0, 10);
  const end = new Date(runMs - LOOKBACK_NEAR_DAYS * DAY).toISOString().substring(0, 10);

  // all-time frequency per canonical item (across the whole DB)
  const freq = {};
  // canonical items ordered within the target week
  const inWeek = new Set();
  for (const row of rows) {
    const p = row.properties || {};
    const name = (p['상품명']?.title || []).map((t) => t.plain_text || '').join('');
    const date = p['구매일']?.date?.start || '';
    if (!name) continue;
    const inWindow = date && date >= start && date < end;
    for (const raw of name.split(',')) {
      const item = raw.trim();
      if (!item || SKIP.test(item)) continue;
      const key = canon(item.replace(/\s+/g, ' ').substring(0, 25));
      if (key.length < 2) continue;
      freq[key] = (freq[key] || 0) + 1;
      if (inWindow) inWeek.add(key);
    }
  }

  const items = [...inWeek].sort((a, b) => freq[b] - freq[a]).slice(0, TOP_N);
  return { items, total: inWeek.size, start, end };
}

function buildSlackMessage(items) {
  const lines = items.map((name) => `• ${name}`).join('\n');
  return {
    text:
      `🍿 *Weekly Restock Reminder*\n\n` +
      `Around this time last month, you ordered these — running low?\n\n` +
      `${lines}\n\n` +
      `_Based on your orders ~4 weeks ago · 📊 <https://14-snack-dashboard.vercel.app|Open dashboard>_`,
  };
}

export default async function handler(req, res) {
  if (!NOTION_TOKEN || !NOTION_SNACK_DB_ID) {
    return res.status(500).json({ error: 'Missing NOTION_TOKEN or NOTION_SNACK_DB_ID env vars' });
  }
  // Reuses the snack-request webhook (already provisioned in Vercel).
  const SLACK_WEBHOOK = process.env.SLACK_SNACK_WEBHOOK;
  if (!SLACK_WEBHOOK) {
    return res.status(500).json({ error: 'SLACK_SNACK_WEBHOOK not configured' });
  }

  try {
    const rows = await fetchAllRows();
    const runDate = new Date().toISOString().substring(0, 10);
    const { items, start, end } = itemsFromWeekLastMonth(rows, runDate);

    // Nothing ordered that week last month → stay quiet (no Slack noise).
    if (items.length === 0) {
      return res.status(200).json({ ok: true, posted: false, reason: 'nothing that week last month', window: { start, end } });
    }

    const slackRes = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSlackMessage(items)),
    });
    if (!slackRes.ok) {
      return res.status(500).json({ error: `Slack error: ${await slackRes.text()}` });
    }

    return res.status(200).json({ ok: true, posted: true, count: items.length, items, window: { start, end } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

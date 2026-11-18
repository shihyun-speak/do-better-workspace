// GET /api/generations -> 쩝쩝박사 generations read live from the Notion 쩝쩝박사 page
//   { configured, generations: [{ name: '8대', start, end, budget }] }
// Reads every toggle titled "N대 쩝쩝박사" and its bullets ("월 예산 : 최대 150만원", "시작일 : 2026-04-06", "종료일 : ...").
// Env: NOTION_GEN_PAGE_ID (the live 쩝쩝박사 page, shared with the Snack Claude integration).
// Without it (or on any error) the pages keep the defaults in shared.js CONFIG.
import { notion } from './_lib.js';

async function children(id) {
  let out = [];
  let cursor;
  do {
    const d = await notion(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    out = out.concat(d.results);
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return out;
}

const text = (b) => ((b[b.type] || {}).rich_text || []).map(t => t.plain_text).join('').trim();

function parseGeneration(title, lines) {
  const g = { name: `${title.match(/(\d+)\s*대/)[1]}대`, start: '', end: '', budget: 0 };
  for (const l of lines) {
    const date = l.match(/(\d{4}-\d{2}-\d{2})/);
    if (/시작일/.test(l) && date) g.start = date[1];
    else if (/종료일/.test(l) && date) g.end = date[1];
    else if (/^(월\s*)?예산/.test(l)) {
      const m = l.match(/([\d,.]+)\s*만\s*원/);
      if (m) g.budget = Math.round(parseFloat(m[1].replace(/,/g, '')) * 10000);
    }
  }
  return g;
}

export default async function handler(req, res) {
  const pageId = process.env.NOTION_GEN_PAGE_ID;
  if (!pageId) return res.status(200).json({ configured: false, generations: [] });
  try {
    const blocks = await children(pageId);
    const toggles = blocks.filter(b => b.type === 'toggle' && /\d+\s*대\s*쩝쩝박사/.test(text(b)));
    const generations = [];
    for (const t of toggles) {
      const lines = (await children(t.id)).map(text).filter(Boolean);
      const g = parseGeneration(text(t), lines);
      if (g.start) generations.push(g);
    }
    generations.sort((a, b) => a.start.localeCompare(b.start));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ configured: true, generations });
  } catch (err) {
    return res.status(200).json({ configured: true, generations: [], error: err.message });
  }
}

// GET  /api/log           -> passcode check + form options (vendors, events) from the Notion schema
// POST /api/log           -> write one purchase (several items) to the snack DB, one row per item
import { checkPasscode, notion, queryAll } from './_lib.js';

export default async function handler(req, res) {
  if (!checkPasscode(req, res)) return;
  const dbId = process.env.NOTION_SNACK_DB_ID;

  try {
    if (req.method === 'GET') {
      const db = await notion(`/databases/${dbId}`);
      const p = db.properties;
      return res.status(200).json({
        ok: true,
        vendors: (p['구매처']?.select?.options || []).map(o => o.name),
        events: (p['Event']?.multi_select?.options || []).map(o => o.name),
        ai: Boolean(process.env.ANTHROPIC_API_KEY),
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { date, vendor, event, items, note, force } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!vendor) return res.status(400).json({ error: 'vendor is required' });
    if (!event) return res.status(400).json({ error: 'event is required' });
    const clean = (Array.isArray(items) ? items : [])
      .map(i => ({ name: String(i.name || '').trim(), price: Math.round(Number(i.price)), qty: Math.max(1, parseInt(i.qty, 10) || 1) }))
      .filter(i => i.name && Number.isFinite(i.price));
    if (!clean.length) return res.status(400).json({ error: 'Add at least one item with a name and price' });
    if (clean.length > 60) return res.status(400).json({ error: 'Too many items in one save (max 60)' });

    // Duplicate check: same date and the same item name (or the name inside a combined row like "하늘보리, 슈가로로").
    if (!force) {
      const sameDay = await queryAll(dbId, { property: '구매일', date: { equals: date } });
      const norm = s => s.replace(/\s+/g, '').toLowerCase();
      const existing = sameDay.map(r => norm((r.properties['상품명']?.title || []).map(t => t.plain_text).join('')));
      const duplicates = clean.filter(i => existing.some(e => e === norm(i.name) || e.includes(norm(i.name)))).map(i => i.name);
      if (duplicates.length) return res.status(409).json({ error: 'Possible duplicates', duplicates });
    }

    const memo = note || '';

    const created = [];
    for (const item of clean) {
      const properties = {
        '상품명': { title: [{ text: { content: item.name.slice(0, 200) } }] },
        '가격': { number: item.price },
        '구매일': { date: { start: date } },
        '구매처': { select: { name: vendor } },
        'Event': { multi_select: [{ name: event }] },
      };
      // price is the line total; quantity goes in 비고 so unit prices can be worked out later
      const rowNote = [item.qty > 1 ? `${item.qty}개` : '', memo].filter(Boolean).join(' / ');
      if (rowNote) properties['비고'] = { rich_text: [{ text: { content: rowNote.slice(0, 500) } }] };
      const page = await notion('/pages', { method: 'POST', body: { parent: { database_id: dbId }, properties } });
      created.push(page.id);
    }
    return res.status(200).json({ ok: true, created: created.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

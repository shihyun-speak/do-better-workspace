// GET  /api/ramp  -> Coupang charges from Ramp that are not logged or dismissed yet,
//                    with Ramp's own receipt OCR line items as a pre-fill
// POST /api/ramp  -> { id, action: 'dismiss' } marks a charge as "not snack"
//
// Env: RAMP_CLIENT_ID, RAMP_CLIENT_SECRET (Ramp developer app, scopes transactions:read receipts:read)
//      RAMP_DISMISS_DB_ID (Notion DB with a title property; one row per dismissed transaction ID)
import { checkPasscode, notion, queryAll, loggedRampIds } from './_lib.js';

const RAMP_API = 'https://api.ramp.com/developer/v1';
const MERCHANT = /coupang|쿠팡/i;
const LOOKBACK_DAYS = 45;

async function rampToken() {
  const basic = Buffer.from(`${process.env.RAMP_CLIENT_ID}:${process.env.RAMP_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${RAMP_API}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'transactions:read receipts:read' }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Ramp token ${r.status}: ${data.error_description || data.error || 'failed'}`);
  return data.access_token;
}

async function ramp(token, path) {
  const r = await fetch(path.startsWith('http') ? path : `${RAMP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Ramp ${r.status}: ${data.error_v2?.message || data.message || 'request failed'}`);
  return data;
}

// Ramp money is integer minor units + a conversion rate (KRW rate is 1).
function won(t) {
  const a = t.original_transaction_amount || t.entity_amount;
  if (a && typeof a.amount === 'number') return Math.round(a.amount / (a.minor_unit_conversion_rate || 1));
  return Math.round(t.amount || 0);
}

async function dismissedIds() {
  const db = process.env.RAMP_DISMISS_DB_ID;
  if (!db) return new Set();
  const rows = await queryAll(db);
  return new Set(rows.map(r => {
    const title = Object.values(r.properties).find(p => p.type === 'title');
    return (title?.title || []).map(t => t.plain_text).join('').trim();
  }));
}

export default async function handler(req, res) {
  if (!checkPasscode(req, res)) return;
  if (!process.env.RAMP_CLIENT_ID || !process.env.RAMP_CLIENT_SECRET) {
    return res.status(200).json({ configured: false, charges: [] });
  }

  try {
    if (req.method === 'POST') {
      const { id, action } = req.body || {};
      if (action !== 'dismiss' || !id) return res.status(400).json({ error: 'Expected { id, action: "dismiss" }' });
      const db = process.env.RAMP_DISMISS_DB_ID;
      if (!db) return res.status(500).json({ error: 'RAMP_DISMISS_DB_ID is not configured' });
      const meta = await notion(`/databases/${db}`);
      const titleProp = Object.entries(meta.properties).find(([, p]) => p.type === 'title')[0];
      await notion('/pages', {
        method: 'POST',
        body: { parent: { database_id: db }, properties: { [titleProp]: { title: [{ text: { content: String(id) } }] } } },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const token = await rampToken();
    const from = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
    let url = `/transactions?from_date=${encodeURIComponent(from)}&page_size=100&order_by_date_desc=true`;
    let txns = [];
    for (let i = 0; url && i < 10; i++) {
      const page = await ramp(token, url);
      txns = txns.concat(page.data || []);
      url = page.page?.next || null;
    }

    const [logged, dismissed] = await Promise.all([loggedRampIds(), dismissedIds()]);
    const pending = txns.filter(t =>
      MERCHANT.test(`${t.merchant_name || ''} ${t.merchant_descriptor || ''}`) &&
      !logged.has(t.id) && !dismissed.has(t.id) &&
      !/declined/i.test(t.state || ''));

    const charges = [];
    for (const t of pending) {
      let items = [];
      let receiptUrl = null;
      const receiptId = (t.receipts || [])[0];
      if (receiptId) {
        try {
          const rc = await ramp(token, `/receipts/${receiptId}`);
          receiptUrl = rc.receipt_url || null;
          items = (rc.ocr?.line_items || [])
            .filter(li => li.item_name)
            .map(li => ({ name: li.item_name, price: Math.round(li.item_total_price ?? (li.item_unit_price || 0) * (li.item_quantity || 1)) }));
        } catch { /* receipt is optional; fall back to manual entry */ }
      }
      const holder = t.card_holder ? `${t.card_holder.first_name || ''} ${t.card_holder.last_name || ''}`.trim() : '';
      charges.push({
        id: t.id,
        date: (t.user_transaction_time || '').slice(0, 10),
        amount: won(t),
        merchant: t.merchant_name || 'Coupang',
        buyer: holder,
        memo: t.memo || '',
        receiptUrl,
        items,
      });
    }
    return res.status(200).json({ configured: true, charges, canDismiss: Boolean(process.env.RAMP_DISMISS_DB_ID) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

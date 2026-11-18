// POST /api/parse-receipt { image: <base64>, mediaType } -> { date, vendor, items:[{name, price}] }
// Optional: only works when ANTHROPIC_API_KEY is set. The page falls back to manual entry otherwise.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { checkPasscode } from './_lib.js';

// Haiku keeps this at roughly ₩1 per receipt. Set ANTHROPIC_MODEL=claude-sonnet-5-5 for better accuracy on messy receipts.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const Receipt = z.object({
  date: z.string().describe('Purchase date as YYYY-MM-DD, or empty string if not visible'),
  vendor: z.string().describe('Store or platform name as shown, e.g. 쿠팡, 네이버, 마켓컬리'),
  total: z.number().describe('Final amount actually paid in KRW (after shipping, coupons, points), or 0 if not visible'),
  items: z.array(z.object({
    name: z.string().describe('Short product name in its original language, without option text or brand noise'),
    price: z.number().describe('Price for ONE unit in KRW after item-level discounts, as an integer'),
    quantity: z.number().describe('How many units were bought (1 if not shown)'),
  })),
});

const PROMPT = `This is a Korean shopping receipt or order screenshot for office snacks.
Extract every purchased product with its price for one unit in KRW and the quantity bought.
Skip shipping fees, coupons, points and order-level discounts; do not invent items.
Keep product names short and recognizable (e.g. "신쫄이 딸기맛", "트루코코 코코넛워터").`;

export default async function handler(req, res) {
  if (!checkPasscode(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(501).json({ error: 'Receipt reading is not set up yet' });

  const { image, mediaType } = req.body || {};
  if (!image || !/^image\/(jpeg|png|webp|gif)$/.test(mediaType || '')) {
    return res.status(400).json({ error: 'Send a JPEG, PNG, WebP or GIF image' });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
      output_config: { format: zodOutputFormat(Receipt) },
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return res.status(422).json({ error: 'Could not read this receipt. Please type the items.' });
    }
    const out = response.parsed_output;
    out.items = out.items.map(i => ({ name: i.name.trim(), price: Math.round(i.price), qty: Math.max(1, Math.round(i.quantity || 1)) })).filter(i => i.name);
    return res.status(200).json(out);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Busy, try again in a minute' });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `Receipt reader error: ${err.message}` });
    return res.status(500).json({ error: err.message });
  }
}

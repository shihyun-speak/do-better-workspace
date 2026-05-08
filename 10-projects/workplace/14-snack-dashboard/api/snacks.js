const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_SNACK_DB_ID = process.env.NOTION_SNACK_DB_ID;
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!NOTION_TOKEN || !NOTION_SNACK_DB_ID) {
    return res.status(500).json({ error: 'Missing NOTION_TOKEN or NOTION_SNACK_DB_ID env vars' });
  }

  try {
    const { filter, sorts } = req.body || {};

    let allResults = [];
    let startCursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const body = { page_size: 100 };
      if (filter) body.filter = filter;
      if (sorts) body.sorts = sorts;
      if (startCursor) body.start_cursor = startCursor;

      const response = await fetch(`${NOTION_API}/databases/${NOTION_SNACK_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `Notion API error: ${err}` });
      }

      const data = await response.json();
      allResults = allResults.concat(data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ results: allResults, count: allResults.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

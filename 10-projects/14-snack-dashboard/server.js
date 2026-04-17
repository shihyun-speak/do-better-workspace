const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_SNACK_DB_ID = process.env.NOTION_SNACK_DB_ID;
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

if (!NOTION_TOKEN) {
  console.error('NOTION_TOKEN is not set. Run with: node --env-file=../../.env server.js');
  process.exit(1);
}
if (!NOTION_SNACK_DB_ID) {
  console.error('NOTION_SNACK_DB_ID is not set. Add it to .env');
  process.exit(1);
}

// Simple in-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// MIME types for static files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

// Query Notion DB with automatic pagination
async function queryNotionDB(filter, sorts) {
  const cacheKey = JSON.stringify({ filter, sorts });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let allResults = [];
  let startCursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`${NOTION_API}/databases/${NOTION_SNACK_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    allResults = allResults.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  setCache(cacheKey, allResults);
  return allResults;
}

// Read request body as JSON
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Serve static files
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // API: Query Notion DB
    if (req.method === 'POST' && req.url === '/api/snacks') {
      const { filter, sorts } = await readBody(req);
      const results = await queryNotionDB(filter, sorts);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ results, count: results.length }));
      return;
    }

    // API: Send snack request to Slack
    if (req.method === 'POST' && req.url === '/api/request') {
      const SLACK_WEBHOOK = process.env.SLACK_SNACK_WEBHOOK;
      if (!SLACK_WEBHOOK) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SLACK_SNACK_WEBHOOK not configured' }));
        return;
      }

      const { name, snack, link } = await readBody(req);
      if (!name || !snack) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name and snack are required' }));
        return;
      }

      const linkLine = link ? `\n🔗 <${link}|Purchase Link>` : '';
      const slackBody = {
        text: `🍿 *New Snack Request!*\n\n*Requested by:* ${name}\n*Snack:* ${snack}${linkLine}\n\n_via <https://14-snack-dashboard.vercel.app|Happy Nyam Nyam Dashboard>_`
      };

      const slackRes = await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackBody),
      });

      if (slackRes.ok) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } else {
        const err = await slackRes.text();
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Slack error: ${err}` }));
      }
      return;
    }

    // API: Clear cache
    if (req.method === 'POST' && req.url === '/api/cache/clear') {
      cache.clear();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, decodeURIComponent(filePath));

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    serveStatic(res, filePath);
  } catch (err) {
    console.error('Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Snack Dashboard running at http://localhost:${PORT}`);
  console.log(`DB: ${NOTION_SNACK_DB_ID}`);
});

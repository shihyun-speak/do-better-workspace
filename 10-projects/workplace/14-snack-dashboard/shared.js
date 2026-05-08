// ── Config ──────────────────────────────────────────────
const CONFIG = {
  BUDGET: 1_500_000,
  BUDGET_HISTORY: {
    '1대': 500_000,
    '2대': 1_250_000, '3대': 1_250_000, '4대': 1_250_000,
    '5대': 1_250_000, '6대': 1_250_000, '7대': 1_250_000,
    '8대': 1_500_000,
  },
  // Generation date ranges (start, end)
  GENERATIONS: [
    { name: '1대', start: '2024-06-03', end: '2024-08-31' },
    { name: '2대', start: '2024-10-28', end: '2024-12-31' },
    { name: '3대', start: '2025-01-06', end: '2025-02-28' },
    { name: '4대', start: '2025-03-19', end: '2025-05-31' },
    { name: '5대', start: '2025-06-16', end: '2025-08-30' },
    { name: '6대', start: '2025-10-20', end: '2025-12-31' },
    { name: '7대', start: '2026-01-12', end: '2026-03-31' },
    { name: '8대', start: '2026-04-06', end: '2026-06-30' },
  ],
  CATEGORY_COLORS: {
    '과자/스낵': '#0846ed',
    '음료':     '#702ae1',
    '과일':     '#ff9560',
    '계절간식':  '#859aff',
    '기타':     '#afadac',
    '미분류':   '#e4e2e1',
  },
  GEN_COLORS: [
    '#0846ed', '#702ae1', '#ff9560', '#859aff',
    '#dcc9ff', '#9c3f00', '#5c5b5b', '#dedcdc',
  ],
};

// ── Notion Data Parser ─────────────────────────────────
function parseNotionResults(results) {
  return results.map(r => {
    const p = r.properties;
    return {
      id: r.id,
      name: p['상품명']?.title?.[0]?.plain_text || '',
      date: p['구매일']?.date?.start || '',
      price: p['가격']?.number || 0,
      event: p['Event']?.select?.name || '',
      vendor: p['구매처']?.select?.name || '',
      note: p['비고']?.rich_text?.[0]?.plain_text || '',
    };
  });
}

// ── API Fetch ──────────────────────────────────────────
async function fetchSnacks(filter, sorts) {
  const res = await fetch('/api/snacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, sorts }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return parseNotionResults(data.results);
}

// Fetch all Office Snacks
async function fetchOfficeSnacks() {
  return fetchSnacks(
    { property: 'Event', select: { equals: 'Office Snacks' } },
    [{ property: '구매일', direction: 'descending' }]
  );
}

// Fetch all records (all event types)
async function fetchAllRecords() {
  return fetchSnacks(
    null,
    [{ property: '구매일', direction: 'descending' }]
  );
}

// ── Formatters ─────────────────────────────────────────
const krwFmt = new Intl.NumberFormat('ko-KR');

function formatKRW(n) {
  if (n >= 1_000_000) return `₩${(n / 10_000).toFixed(0)}만`;
  if (n >= 10_000) return `₩${krwFmt.format(n)}`;
  return `₩${krwFmt.format(n)}`;
}

function formatKRWFull(n) {
  return `₩${krwFmt.format(n)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ── Date Helpers ───────────────────────────────────────
function getMonthRange(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`;
  return { start, end };
}

function getDaysRemaining() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

function getMonthLabel(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()];
}

function getYearMonth(dateStr) {
  return dateStr.substring(0, 7); // "2026-04"
}

// ── Generation Helper ──────────────────────────────────
function getGeneration(dateStr) {
  if (!dateStr) return '미정';
  for (const gen of CONFIG.GENERATIONS) {
    if (dateStr >= gen.start && dateStr <= gen.end) return gen.name;
  }
  return '미정';
}

function getBudgetForGen(genName) {
  return CONFIG.BUDGET_HISTORY[genName] || CONFIG.BUDGET;
}

// ── Category Detection (from product name) ─────────────
const CATEGORY_RULES = [
  { category: '음료', keywords: ['하늘보리', '루이보스', '보리차', '에코보리', '링티', '토레타', '코카콜라', '콜라', '탄산수', '에이드', '포카리', '프로틴 음료', '허쉬드링크', '허쉬 드링크', '오이오차', '초록매실', '태양의식후비법', '핫초코', '호박팥차', '캐모마일', '트와이닝', '결명자', '네스프레소', '두유', '매일두유', '아몬드브리즈', '바나나우유', '바나나 우유', '미숫가루', '요구르트', '코코넛워터'] },
  { category: '과일', keywords: ['감귤', '만다린', '바나나', '딸기', '블루베리', '방울토마토', '과일', '오렌지주스', '돈시몬'] },
  { category: '유제품/건강', keywords: ['요거트', '요거톡', '비요뜨', '그릭요거트', '랩노쉬', '에너지바', '프로틴', '메추리알', '훈제', '닭가슴살', '벌꿀', '너트', '한줌너트'] },
  { category: '과자/스낵', keywords: ['과자', '칸쵸', '치토스', '스키틀즈', '하리보', '곤약', '고구마스틱', '썬칩', '다이제', '몽쉘', '쿠크다스', '뻥이요', '뉴룽지', '무뚝뚝', '꽈배기', '김칩스', '약과', '노리마끼', '부샤드', '리콜라', '사랑방캔디', '쫀득이', '코코넛 과자', '가나', '스콘', '반시', '쌀과자', '봉지과자', '오뜨', '다크초코', '초콜릿'] },
  { category: '계절간식', keywords: ['아이스크림', '호빵', '붕어빵', '떡', '창억떡', '생일케이크'] },
  { category: '식사/간편식', keywords: ['컵라면', '컵누들', '햇반', '육개장'] },
];

// Normalize similar item names (루이보스차 → 루이보스, 바나나우유 → 바나나 우유, etc.)
const ITEM_ALIASES = {
  '루이보스차': '루이보스', '루이보스 차': '루이보스', '하늘보리,': '하늘보리',
  '바나나우유': '바나나 우유', '아몬드브리즈초코': '아몬드브리즈',
  '아몬드브리즈 초콜릿': '아몬드브리즈', '아몬드브리즈 언스위트': '아몬드브리즈',
  '제로코카콜라': '코카콜라 제로', '제로콜라': '코카콜라 제로',
  '미숫가루 소잘유': '미숫가루', '미숫가루우유': '미숫가루',
  '제주감귤': '감귤', '만다린': '감귤',
};

function normalizeItemName(name) {
  let n = name.trim();
  if (ITEM_ALIASES[n]) return ITEM_ALIASES[n];
  // Remove trailing punctuation
  n = n.replace(/[,.\s]+$/, '');
  if (ITEM_ALIASES[n]) return ITEM_ALIASES[n];
  return n;
}

function detectCategory(name) {
  if (!name) return '기타';

  // Check for bulk/mixed orders first
  if (name.includes('스낵24')) return '정기구독(스낵24)';
  if (name.match(/^(간식|음료|비품).*(대량|주문|구매|추가|조금|세트)/) || name === '이것저것 많이') return '혼합주문';

  // Count category hits from comma-separated items
  const items = name.split(',').map(s => s.trim());
  const hits = {};

  for (const item of items) {
    for (const rule of CATEGORY_RULES) {
      for (const kw of rule.keywords) {
        if (item.includes(kw)) {
          hits[rule.category] = (hits[rule.category] || 0) + 1;
          break;
        }
      }
    }
  }

  const entries = Object.entries(hits);
  if (entries.length === 0) return '기타';
  if (entries.length === 1) return entries[0][0];

  // Pick dominant category (even on tie — pick first by priority order)
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function groupByCategoryDetected(records) {
  const groups = {};
  for (const r of records) {
    const cat = detectCategory(r.name);
    if (!groups[cat]) groups[cat] = { total: 0, count: 0, items: [] };
    groups[cat].total += r.price;
    groups[cat].count++;
    groups[cat].items.push(r.name);
  }
  return groups;
}

// ── Data Aggregation ───────────────────────────────────
function groupByMonth(records) {
  const groups = {};
  for (const r of records) {
    const ym = getYearMonth(r.date);
    if (!ym) continue;
    if (!groups[ym]) groups[ym] = { total: 0, records: [], month: ym };
    groups[ym].total += r.price;
    groups[ym].records.push(r);
  }
  return Object.values(groups).sort((a, b) => a.month.localeCompare(b.month));
}

function groupByCategory(records) {
  const groups = {};
  for (const r of records) {
    const cat = r.category || '미분류';
    if (!groups[cat]) groups[cat] = { total: 0, count: 0 };
    groups[cat].total += r.price;
    groups[cat].count++;
  }
  return groups;
}

function groupByVendor(records) {
  const groups = {};
  for (const r of records) {
    const v = r.vendor || '기타';
    if (!groups[v]) groups[v] = { total: 0, count: 0 };
    groups[v].total += r.price;
    groups[v].count++;
  }
  return groups;
}

// ── UI Helpers ─────────────────────────────────────────
function getBudgetStatus(percentage) {
  if (percentage >= 90) return { label: 'Critical', color: 'error', bgClass: 'bg-error/10', textClass: 'text-error' };
  if (percentage >= 70) return { label: 'Caution', color: 'tertiary', bgClass: 'bg-tertiary/10', textClass: 'text-tertiary' };
  return { label: 'On Track', color: 'primary', bgClass: 'bg-primary/10', textClass: 'text-primary' };
}

function showError(container, message) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <span class="material-symbols-outlined text-5xl mb-4">cloud_off</span>
      <p class="font-headline text-lg mb-2">데이터를 불러올 수 없습니다</p>
      <p class="text-sm mb-4">${message}</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-primary text-white rounded-full text-sm">
        다시 시도
      </button>
    </div>
  `;
}

function showLoading(container) {
  container.innerHTML = `
    <div class="animate-pulse space-y-4 p-6">
      <div class="h-8 bg-surface-container-high rounded-xl w-1/3"></div>
      <div class="h-32 bg-surface-container-high rounded-xl"></div>
      <div class="h-4 bg-surface-container-high rounded-xl w-2/3"></div>
    </div>
  `;
}

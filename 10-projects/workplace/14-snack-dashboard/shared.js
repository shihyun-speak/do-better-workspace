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
    '과자/스낵': '#1F8A5B',
    '음료':     '#2B7A6B',
    '과일':     '#E8A33D',
    '계절간식':  '#8CC7A1',
    '기타':     '#A3B8B0',
    '미분류':   '#D5E3DC',
  },
  GEN_COLORS: [
    '#1F8A5B', '#2B7A6B', '#E8A33D', '#8CC7A1',
    '#6E7FCF', '#D9822B', '#A3B8B0', '#D5E3DC',
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
      event: p['Event']?.multi_select?.[0]?.name || p['Event']?.select?.name || '',
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
    { property: 'Event', multi_select: { contains: 'Office Snacks' } },
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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// Generations come live from the Notion 쩝쩝박사 page (api/generations.js); CONFIG above is the fallback.
async function loadGenerations() {
  try {
    const r = await fetch('/api/generations');
    const d = await r.json();
    const gens = (d.generations || []).filter(g => g.start);
    if (!gens.length) return;
    CONFIG.GENERATIONS = gens.map(g => ({ name: g.name, start: g.start, end: g.end || '9999-12-31' }));
    gens.forEach(g => { if (g.budget) CONFIG.BUDGET_HISTORY[g.name] = g.budget; });
    const latest = gens[gens.length - 1];
    if (latest.budget) CONFIG.BUDGET = latest.budget;
  } catch { /* keep defaults */ }
}

function getBudgetForGen(genName) {
  return CONFIG.BUDGET_HISTORY[genName] || CONFIG.BUDGET;
}

// ── Category Detection (from product name) ─────────────
// Snack categories, built from real item names in the Notion DB (2026-11-18).
// Each comma-separated item takes the FIRST rule that matches, so order matters
// (e.g. 바나나우유 hits 우유/유제품 before 과일).
const CATEGORY_RULES = [
  { category: '우유/유제품', keywords: ['우유', '두유', '오트밀크', '아몬드브리즈', '요거트', '요거톡', '비요뜨', '요구르트', '상하목장', '밀크'] },
  { category: '차', keywords: ['하늘보리', '보리차', '에코보리', '루이보스', '쑥차', '우롱', '옥수수수염', '그린티', '녹차', '자스민', '메밀차', '오르조', '티백', '홍차', '캐모마일', '트와이닝', '결명자', '호박팥차', '오이오차', '말차', '티즐', '도밍고', '태양의식후비법', '차 주문', '차 구매'] },
  { category: '음료', keywords: ['코카콜라', '제로콜라', '펩시', '사이다', '탄산수', '트레비', '에이드', '소다', '포카리', '토레타', '링티', '초록매실', '코코넛워터', '코코제로', '식혜', '핫초코', '드링크', '네스프레소', '커피', '주스', '돈시몬', '미숫가루', '음료', '생수', '레몬수'] },
  { category: '과일', keywords: ['감귤', '만다린', '귤', '바나나', '딸기', '블루베리', '방울토마토', '토마토', '사과', '포도', '샤인머스캣', '키위', '과일', '신선식품', '쿠팡프레쉬'] },
  { category: '단백질/건강', keywords: ['프로틴', '단백', '셀렉스', '테이크핏', '랩노쉬', '에너지바', '닭가슴살', '메추리알', '훈제', '반숙란', '참숯란', '계란', '너트', '넛츠', '견과', '그래놀라', '땅콩버터', '시리얼', '뉴트리오코', '벌꿀', '곤약'] },
  { category: '디저트/아이스크림', keywords: ['아이스크림', '디핀다츠', '모나카', '라라스윗', '빙수', '설빙', '요아정', '케이크', '도넛', '도너츠', '크리스피', '와플', '호빵', '붕어빵', '창억떡', '떡', '비파티세리', '계란빵', '두바이'] },
  { category: '빵/간편식', keywords: ['식빵', '베이글', '토스트', '빵', '두부리또', '구운감자', '라면', '컵누들', '햇반', '육개장', '만두', '핫도그'] },
  { category: '과자/젤리', keywords: ['과자', '칩', '스낵', '젤리', '캔디', '사탕', '새콤달콤', '딸몽', '하리보', '스키틀즈', '껌', '초코바', '초콜릿', '초코', '가나', '쿠크다스', '다이제', '몽쉘', '칸쵸', '치토스', '팝코너스', '누룽지', '뉴룽지', '비쵸비', '부각', '맛밤', '밤', '고구마', '약과', '꽈배기', '쫀득이', '뻥이요', '무뚝뚝', '노리마끼', '부샤드', '리콜라', '오뜨', '스콘', '반시', '트롤리', '주전부리'] },
];
// Whole-row patterns checked before item keywords
const EVENT_ROW = /bi-?weekly|바이위클리|happy hour|breakfast|파티|visitor|new hire|입사|화이트데이|생일|졸업|치킨|피자|닭강정|마라/i;
const BULK_ROW = /대량|다량|추가 주문|간식 주문|음료 주문|간식 구매|음료 구매|음료 구입|간식, 음료|등$|등 |^쿠팡 간식$|셀렉션|^쿠팡 대량/;

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
  if (name.includes('스낵24')) return '스낵24 정기구독';
  if (EVENT_ROW.test(name)) return '이벤트/모임';

  // Count category hits over comma-separated items (first matching rule per item)
  const hits = {};
  for (const item of name.split(',').map(s => s.trim()).filter(Boolean)) {
    const rule = CATEGORY_RULES.find(r => r.keywords.some(kw => item.includes(kw)));
    if (rule) hits[rule.category] = (hits[rule.category] || 0) + 1;
  }
  const entries = Object.entries(hits);
  if (entries.length) return entries.sort((a, b) => b[1] - a[1])[0][0];
  if (BULK_ROW.test(name) || /^(간식|음료|비품)/.test(name) || name === '이것저것 많이') return '대량/혼합 주문';
  return '기타';
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

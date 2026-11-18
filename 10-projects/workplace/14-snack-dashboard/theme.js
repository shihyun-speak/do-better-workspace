// ── Theme: "Clean Pantry", Fresh green palette (2026-11-18) ───────────────────────────────
// Shared Tailwind config + component styles for every page. Load right after the Tailwind CDN script.
// 2026-11-18: moved from the warm cream/Fredoka look to a cleaner neutral one.
// Token names (cream, ink, berry...) are kept so page markup did not need to change.

tailwind.config = {
  theme: {
    extend: {
      colors: {
        cream: '#F3FAF6',        // page background (mint)
        'cream-deep': '#E5F1EB', // tracks, skeletons, subtle fills
        line: '#DCEAE2',
        ink: '#16302B',          // deep green-black text
        'ink-soft': '#5B746D',
        berry: '#D9822B',        // "over budget" / warnings: amber (deeper so text stays readable)
        'berry-soft': '#FCF0E1',
        mango: '#E8A33D',
        'mango-ink': '#875A12',
        'mango-soft': '#FDF4E3',
        mint: '#1F8A5B',         // main accent: leaf green ("under budget", buttons)
        'mint-soft': '#E2F3EA',
        blue: '#2B7A6B',         // links, focus, Bi-weekly: teal-green
        'blue-soft': '#E0F0EC',
        grape: '#6E7FCF',
        'grape-soft': '#ECEFFA',
      },
      fontFamily: {
        display: ['Pretendard Variable', 'Pretendard', '-apple-system', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        body: ['Pretendard Variable', 'Pretendard', '-apple-system', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
      },
    },
  },
};

// Chart palette, in order of use
const SNACK_COLORS = ['#1F8A5B', '#E8A33D', '#2B7A6B', '#8CC7A1', '#6E7FCF', '#D9822B', '#A3B8B0', '#D5E3DC'];

// Event → color token
const EVENT_STYLE = {
  'Office Snacks': 'mint',
  'Bi-weekly':     'blue',
  'Happy Hour':    'mango',
  'Other Events':  'grape',
};
const eventColor = (event) => EVENT_STYLE[event] || 'grape';

document.head.insertAdjacentHTML('beforeend', `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
<style>
  html { font-size: 14px; } /* everything is sized in rem, so this scales the whole site down ~12% */
  body { background: #F3FAF6; -webkit-font-smoothing: antialiased; letter-spacing: -0.005em; }
  .font-display { letter-spacing: -0.02em; }
  .card { border: 1px solid #DCEAE2; border-radius: 12px; box-shadow: 0 1px 2px rgba(22,48,43,.04); }
  .card:not([class*="bg-"]) { background: #fff; }
  .btn { border-radius: 10px; font-weight: 600; transition: background .15s, filter .15s; }
  .btn:hover { filter: brightness(.96); }
  .btn:disabled { opacity: .45; cursor: not-allowed; filter: none; }
  input.field, select.field, textarea.field, .field { width: 100%; border: 1px solid #DCEAE2; border-radius: 10px; padding: .55rem .8rem; font-size: .875rem; }
  .field:not([class*="bg-"]) { background-color: #fff; }
  input.field:focus, select.field:focus, textarea.field:focus { outline: none; border-color: #1F8A5B; box-shadow: 0 0 0 3px #E2F3EA; --tw-ring-shadow: 0 0 #0000; }
  select.field { padding-right: 2rem; }
  .chip { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid #DCEAE2; border-radius: 9999px; padding: .3rem .75rem; font-size: .75rem; font-weight: 600; transition: background .15s, color .15s; }
  .chip:not([class*="bg-"]) { background: #fff; }
  button.chip:hover { background: #E5F1EB; }
  .chip.active { background: #1F8A5B; border-color: #1F8A5B; color: #fff; }
  .dot { width: .5rem; height: .5rem; border-radius: 9999px; display: inline-block; flex-shrink: 0; }
  .nav-pill { padding: .4rem .8rem; border-radius: 8px; font-weight: 600; font-size: .875rem; color: #5B746D; }
  .nav-pill:hover { color: #16302B; background: #E5F1EB; }
  .nav-pill.active { background: #fff; color: #1F8A5B; box-shadow: 0 0 0 1px #DCEAE2, 0 1px 2px rgba(22,48,43,.05); }
  .bar-track { background: #E5F1EB; border-radius: 9999px; overflow: hidden; }
  .eyebrow { font-size: .72rem; font-weight: 600; color: #5B746D; }
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  /* ── Snack jar hero ── */
  .hero { background: radial-gradient(120% 140% at 0% 0%, #DDF3E7 0%, #EEF8F2 45%, #FFFFFF 100%); border: 1px solid #DCEAE2; }
  .hero::after { content: ''; position: absolute; right: -80px; top: -80px; width: 260px; height: 260px; border-radius: 9999px; background: radial-gradient(circle, rgba(232,163,61,.16), transparent 70%); pointer-events: none; }
  .coin { animation: coin-drop .7s cubic-bezier(.3,1.35,.5,1) both; }
  @keyframes coin-drop { 0% { transform: translateY(-240px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(0); } }
  /* one coin keeps dropping into the lid slot */
  .coin-float { position: absolute; left: 50%; top: 0; width: 26px; height: 26px; margin-left: -13px; border-radius: 9999px;
    background: radial-gradient(circle at 35% 30%, #FBE5A2 0 18%, #E9B949 19% 62%, #C9952F 63% 70%, #E9B949 71%);
    box-shadow: 0 2px 4px rgba(22,48,43,.2); animation: coin-slot 3.6s ease-in infinite; }
  @keyframes coin-slot { 0%, 35% { transform: translateY(-34px) scaleX(1); opacity: 0; } 45% { opacity: 1; } 70% { transform: translateY(-6px) scaleX(1); opacity: 1; } 82% { transform: translateY(6px) scaleX(.25); opacity: 0; } 100% { opacity: 0; } }
  .hero-stats > div { padding-right: 1.5rem; margin-right: 1.5rem; border-right: 1px solid #DCEAE2; }
  .hero-stats > div:last-child { border-right: 0; margin-right: 0; padding-right: 0; }
  @media (max-width: 639px) {
    .hero-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .hero-stats > div, .hero-stats > div:last-child { border-right: 0; margin-right: 0; padding-right: .5rem; }
  }
  .hero-stats dt { font-size: .72rem; font-weight: 600; color: #5B746D; }
  .hero-stats dd { font-size: 1.25rem; font-weight: 700; margin-top: .1rem; font-variant-numeric: tabular-nums; }

  /* ── Motion elsewhere ── */
  .bar-grow { transform-origin: bottom; animation: bar-grow .8s cubic-bezier(.22,.9,.3,1) both; }
  @keyframes bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .card { transition: transform .2s ease, box-shadow .2s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(22,48,43,.07); }
  form.card:hover, form .card:hover { transform: none; }

  @media (prefers-reduced-motion: reduce) {
    .btn, .card { transition: none; }
    .coin, .bar-grow { animation: none; } .coin-float { display: none; }
  }
</style>`);

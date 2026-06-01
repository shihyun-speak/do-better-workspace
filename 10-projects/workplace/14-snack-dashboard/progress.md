# Happy Nyam Nyam — Progress Tracker

**Live URL**: https://14-snack-dashboard.vercel.app
**Started**: 2026-04-16

---

## Completed

### Infrastructure
- [x] Notion DB connected (`34414daa-65af-809f-83aa-c82a71f2da63`)
- [x] Node.js proxy server (`server.js`) — zero deps, 5-min cache, auto pagination
- [x] Shared utilities (`shared.js`) — data parser, formatters, category detection
- [x] Vercel deployment with env vars (`NOTION_TOKEN`, `NOTION_SNACK_DB_ID`)

### Dashboard Page (index.html)
- [x] **Budget Gauge** — real-time spending vs ₩1.5M, color-coded (green/orange/red)
- [x] **Budget Alert Banner** — warning at 70%, critical at 90%
- [x] **Monthly Spending Trend** — bar chart, last 12 months, generation labels, budget line overlay
- [x] **Snack Categories Pie Chart** — auto-categorized from product names (음료/과자/과일 etc.)
  - [x] Period filter: All Time / This Month / Last Month / Last 3 Months
- [x] **This Month Quick Stats** — orders, avg per order, per-person cost (editable headcount)
- [x] **Popular Items Ranking** — top 5 most ordered items with name normalization
- [x] **Restock Reminder** — items not ordered in 14+ days (only 3+ time regulars)
- [x] **Purchase History Table** — searchable, filterable by event type
- [x] **Recent Purchases** — last 5 orders

### Slack Integration
- [x] **Snack request button** → Slack (`/api/request`, `SLACK_SNACK_WEBHOOK`)
- [x] **Weekly Restock Reminder** → `#happy-nyam-nyam` (`/api/restock`, reuses `SLACK_SNACK_WEBHOOK`)
  - Vercel Cron: Mondays 09:00 KST (`0 0 * * 1` UTC)
  - "What did I order ~4 weeks ago this week?" — mirrors the monthly buying rhythm so each week's list differs
  - Window: orders dated [run − 35d, run − 28d); ranked by all-time order frequency, top 7 shown
  - Aliases merged: 감귤=만다린, 루이보스=루이보스차, 요거트=그릭요거트=요거톡
  - Stays silent when nothing was ordered that week last month

### Analytics Page (analytics.html)
- [x] **Donut Chart** — groupable by Vendor / Category / Event
  - [x] Period filter: This Month / Last Month / 3/6/12 Months / All Time
- [x] **Key Metrics Summary** — total spend, office snacks only, monthly avg, order count
- [x] **Spending by Event Type** — progress bars (Office Snacks / Bi-weekly / Happy Hour)
- [x] **Generation Comparison** — avg monthly spend per 쩝쩝박사 generation (1대~8대)
- [x] **Monthly Per-Capita** — cost per person with editable headcount

### Design / UX
- [x] Light theme — off-white + red/gold accents (The Strokes inspired)
- [x] Space Grotesk + Space Mono fonts
- [x] Top tab navigation (sidebar removed)
- [x] "Happy Nyam Nyam" branding
- [x] Item name normalization (루이보스차 → 루이보스, 제주감귤 → 감귤, etc.)
- [x] Category legend deduplication (기타 merge)

---

## Backlog / Ideas

- [ ] Dark mode toggle
- [ ] Notion DB에 `카테고리` 필드 추가 → 수동 분류 (현재는 상품명 키워드 추정)
- [ ] 스낵24 자동 연동 (위펀 앱 export 가능 여부 확인)
- [ ] 영수증 입력 간소화 (Slack bot → Notion 자동 입력?)
- [ ] 이벤트별 예산 별도 tracking (Bi-weekly, Happy Hour)
- [ ] Mobile responsive 최적화
- [ ] 쩝쩝박사 임기 카운트다운 위젯
- [ ] CSV export 기능

---

## Tech Stack

| Component | Tech |
|-----------|------|
| Frontend | Single-file HTML + Tailwind CSS (CDN) |
| Fonts | Space Grotesk + Space Mono |
| Charts | Pure CSS bars + SVG donut (no library) |
| Backend | Node.js proxy (`server.js`, zero deps) |
| Data | Notion API (REST) |
| Hosting | Vercel (serverless function + static) |
| Category Detection | Keyword matching from product names |

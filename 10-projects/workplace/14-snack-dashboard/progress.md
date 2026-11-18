# Happy Nyam Nyam — Progress Tracker

**Live URL**: https://happy-nyam-nyam.vercel.app (old https://14-snack-dashboard.vercel.app still works)
**Started**: 2026-04-16

---

## Start here (as of 2026-11-18, commit fc43976)

**Live:** dashboard (coin jar hero, Fresh green theme), Analytics, To log page (passcode `LOG_PASSCODE` in `.env` / Vercel prod). Shihyun is already saving receipts through To log (30 Office Snacks orders logged for Nov on 11/18).

**Deploy:** `vercel deploy --prod --yes` from this folder (CLI deploy, not git). `.vercelignore` keeps md/prototypes/server.js/scripts off the public site.

**Scheduled (Vercel Cron, 2 of 2 Hobby slots used):**
- `/api/restock` Mon 09:00 KST, weekly restock reminder
- `/api/recap` Mon + Fri 10:00 KST: 4th Monday reminder (tags Shihyun, "🧾 Log your receipts" button), Friday recap card ("<Month> Snack Recap: Budget Safe! 🟢", Most popular / New this month, "📊 See dashboard"). First posts: Mon 11/23, Fri 11/27
- Preview: `/api/recap?dry=1&kind=reminder|recap`. Test DMs go via the Bloop bot (`BLOOP_SLACK_BOT_TOKEN`, DM channel `D0CEXB1GD4K`); the nyam bot only has the channel webhook

**Open items**
- [ ] Jan 1 2027 recap (for December) lands on New Year's Day: leave or move to next workday? (asked, no answer yet)
- [ ] Tune the "Paste order text" parser with a real copied Coupang / Naver order page (built on a made-up sample)
- [x] Ramp code removed 2026-11-18 (api/ramp.js deleted, Ramp bits stripped from _lib.js / log.js / server.js)
- [ ] Optional: `ANTHROPIC_API_KEY` in Vercel to auto-read dropped receipts (Haiku, ~₩1/receipt). Without it, manual entry next to the big receipt picture
- [ ] Possible next: give Most ordered / Running low / Recent purchases the same playful treatment as the jar (offered, not requested)
- [x] Fixed Notion typo "오이오차 녹찿" -> "오이오차 녹차" (row from 2026-11-02)

**Shihyun's preferences from this session:** design changes deploy straight to prod and she reviews live; Slack posts in English, short, no won amounts (budget mood only); Slack card layout with emoji on buttons, no long dividers; she likes playful visuals (coin jar) over plain boxes.

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

### Receipt folder flow (2026-11-18), the chosen approach
- [x] Drop receipt screenshots/photos in `receipts/inbox/` (gitignored), run `/snack-receipts` in Claude Code
- [x] Claude reads each image, proposes items/date/vendor/event, Shihyun approves, edits or skips each one
- [x] `scripts/log-snacks.mjs` saves approved items (one Notion row per item), checks vendor/event against DB options, flags possible duplicates (same date, same or contained item name), moves the receipt to `receipts/logged/`
- [x] Tested with dry runs (validation, duplicate detection). First real save not done yet
- Terminal fallback. Shihyun wants it on the website, so the To log page below is the main path

### To log page (log.html), built 2026-11-18, DEPLOYED to production 2026-11-18 (with the clean design; `LOG_PASSCODE` set in Vercel prod; `.vercelignore` now keeps md/prototype/server files off the public site)
- Paste order text box (no AI): rule-based parser for text copied from Coupang/Naver order pages. Written against a made-up sample; tune with a real copied page. Open question: is "5,280원 2개" a unit or line price?
**Current version (receipt-only, no Ramp UI):** drop/choose/paste receipt, AI pre-fill (needs `ANTHROPIC_API_KEY`), compares items total with paid total from the receipt, duplicate check returns 409 and the page offers "Save anyway", "Saved this session" list. `api/ramp.js` is still in the repo but unused by the page.
To go live: Vercel env `LOG_PASSCODE` + `ANTHROPIC_API_KEY`, then deploy.

Original notes (Ramp version):
- [x] Passcode-gated page (`LOG_PASSCODE`); passcode remembered in the browser, "Lock" clears it
- [x] **From Ramp**: Coupang charges (last 45 days) not yet logged or dismissed; items pre-filled from Ramp's own receipt OCR (free, no AI). "Log" opens the editor, "Not snack" dismisses
  - Dedupe: saved rows carry `Ramp:<txn id>` in 비고; dismissed IDs are rows in a separate Notion DB (`RAMP_DISMISS_DB_ID`)
  - Editor shows items total vs Ramp charge, "Add the difference as 배송비/할인" button
- [x] **Add a receipt**: drop / choose / paste a screenshot (shrunk to 1568px JPEG in the browser), or "enter items without a receipt"
  - With `ANTHROPIC_API_KEY`: `/api/parse-receipt` pre-fills date, vendor, items (default `claude-haiku-5-5`, override with `ANTHROPIC_MODEL`)
- [x] Save = one Notion row per item (상품명, 가격, 구매일, 구매처, Event, 비고). 구매자 (people) is not set; buyer name goes in 비고 for Ramp charges
- [x] API: `api/log.js` (GET options + passcode check, POST save), `api/ramp.js`, `api/parse-receipt.js`, shared `api/_lib.js`; local `server.js` imports the same handlers
- [x] Tested locally: passcode, options, validation, "not set up" states. A real Notion write and the Ramp calls are untested (no Ramp creds yet; Ramp code written from their OpenAPI spec)

**Setup still needed**
1. Vercel env: `LOG_PASSCODE` (local one is in `.env`)
2. Ramp developer app (client credentials, scopes `transactions:read receipts:read`) -> `RAMP_CLIENT_ID`, `RAMP_CLIENT_SECRET`. Ask the Ramp admin (Finance)
3. Notion DB for dismissed charges (one title column), shared with the snack integration -> `RAMP_DISMISS_DB_ID`
4. Optional: `ANTHROPIC_API_KEY` for receipt pre-fill
5. Check the Ramp merchant name for Coupang matches `/coupang|쿠팡/i` (api/ramp.js `MERCHANT`)

### Categories + live generations (2026-11-18, live)
- Category rules rebuilt from real item names (`shared.js` CATEGORY_RULES, first match per item): 차, 음료, 우유/유제품, 과일, 단백질/건강, 과자/젤리, 빵/간편식, 디저트/아이스크림 + row-level 이벤트/모임, 대량/혼합 주문, 스낵24 정기구독. 기타 went from 39% of spend to 0%
- Analytics legend shows the top 3 items under each slice
- Generations now read live from the Notion 쩝쩝박사 페이지 (`api/generations.js`, env `NOTION_GEN_PAGE_ID=127792ec-2f10-80e0-8d31-d96b5d3037b5`, shared with Snack Claude on 11/18). Live page has 9대 (7/1-9/30) and 10대 (10/1-12/31), ₩150만. CONFIG in shared.js is the fallback; current BUDGET follows the latest generation
- "Notion" button in the header of Dashboard and Analytics opens the 쩝쩝박사 page

### Monthly 정산 posts (2026-11-18, live)
- `api/recap.js`, one Vercel Cron `0 1 * * 1,5` (Mon + Fri 10:00 KST; Hobby plan allows only 2 crons, restock has the other)
- Format: Slack Block Kit cards, all English (2026-11-18). Buttons have emojis on the left; no divider
- 4th Monday (day 22-28 KST): "🧾 Time to close out <Month>!" + tag Shihyun + green "🧾 Log your receipts" button (/log.html)
- Friday of that week: header "🧾 <Month> Snack Recap: <mood>" (Budget Safe! 🟢 / Budget Tight 👀 / Over Budget! 🚨)", budget mood in the title only, no divider or budget row (Safe! 🟢 <70%, Getting tight 👀 70-100%, Over budget! 🚨), two columns: 🔥 Most popular top 3 / ✨ New this month (5 newest), "📊 See dashboard" button. Recaps the Monday's month even if Friday is in the next month
- Test previews DM'd to Shihyun 2026-11-18 via the Bloop bot (BLOOP_SLACK_BOT_TOKEN); the nyam bot has no token, only the channel webhook
- Schedule: 11/23 reminder, 11/27 recap; 12/28, then 2027-01-01 recap (holiday)
- `?dry=1&kind=reminder|recap` previews; `?force=1&kind=...` + `x-log-passcode` posts now

### Snack jar hero + green palette (2026-11-18, live)
- Fresh green palette in `theme.js` (mint bg #F3FAF6, leaf green #1F8A5B accent, amber #D9822B for over budget); chart palettes in `shared.js` updated
- Dashboard top: coin jar SVG (coin pile height = budget left, seeded so it is stable, coins drop in on load, one coin loops into the lid slot), count-up numbers, the 3 stat boxes folded into an inline stat row
- Monthly bars grow in (staggered), cards lift slightly on hover; all motion off under prefers-reduced-motion
- Base font 14px (site felt too big); To log page: big receipt picture, Ea column (qty in 비고 as "N개"), past-item autocomplete + last price, live comma formatting
- URL: https://happy-nyam-nyam.vercel.app (alias added to the project; old URL still works)

### Design refresh 2026-11-18 (cleaner look)
- [x] `theme.js` moved to a neutral palette (white cards, #F7F7F8 background, zinc text), Pretendard font, smaller radii, lighter shadows; token names unchanged so markup stayed the same
- [x] Old Fredoka/Nunito fonts removed, heavy weights toned down, nav pills now white/outlined
- [x] Fixed Tailwind forms plugin overriding input borders; removed "·" separators from UI text

### Fixes
- [x] **2026-10-07: dashboard showed no data** — Notion `Event` column was changed from select to multi-select, so the `select equals` filter returned 400. `shared.js` now filters with `multi_select contains` and parses the first tag (falls back to `select`). Rows with multiple Event tags are counted under the first tag only.
- [x] "Last month" range fixed (could pick the wrong month near month-end; now sets day 1 before subtracting)

### Design / UX
- [x] **2026-10-07 redesign** — warm "snack shop" look: cream background, hairline-border cards with soft shadows, Fredoka (headings) + Nunito (body), berry/mango/mint/blue/grape palette
  - Shared theme in `theme.js` (Tailwind config + component CSS), used by both pages
  - No emoji in the UI (first pass had them, user asked to remove); events shown as colored dots
  - Dashboard layout: budget hero first ("₩X left", status label On track / Pace yourselves / Almost out, days left, daily allowance), stat tiles (orders, avg/order, last month), chart + request form, then Most ordered / Running low? / Recent purchases, then history with event filter chips
  - Monthly chart: per-month dashed budget line (earlier gens had ₩125만), green = under, pink = over, current month faded
  - Old separate budget alert banner folded into the hero status
- [x] Top tab navigation (sidebar removed)
- [x] "Happy Nyam Nyam" branding
- [x] Item name normalization (루이보스차 → 루이보스, 제주감귤 → 감귤, etc.)
- [x] Category legend deduplication (기타 merge)

---

## Backlog / Ideas

- [ ] Dark mode toggle
- [ ] Notion DB에 `카테고리` 필드 추가 → 수동 분류 (현재는 상품명 키워드 추정)
- [ ] 스낵24 자동 연동 (위펀 앱 export 가능 여부 확인)
- [x] 영수증 입력 간소화 -> To log page (see above)
- [ ] 스낵24 monthly auto-import: 위펀 monthly report email (no-reply@wefun.io) has an xlsx with a "N월 상세내역" sheet (출고일, 대분류/중분류, 품목, 수량, 단가, 합계 + 반품 rows). Filter to "(스낵)" 거래처; skip 플랜테리어24. Weekly "상품리스트 마감" email has no items
- [ ] 이벤트별 예산 별도 tracking (Bi-weekly, Happy Hour)
- [ ] Mobile responsive 최적화 (redesign is responsive but not visually checked on a phone yet)
- [ ] Visually QA the 2026-10-07 redesign (Analytics page + mobile); headless screenshots failed
- [ ] 쩝쩝박사 임기 카운트다운 위젯
- [ ] CSV export 기능

---

## Tech Stack

| Component | Tech |
|-----------|------|
| Frontend | HTML pages + Tailwind CSS (CDN), shared `theme.js` |
| Fonts | Fredoka + Nunito (Google Fonts) |
| Charts | Pure CSS bars + SVG donut (no library) |
| Backend | Node.js proxy (`server.js`, zero deps) |
| Data | Notion API (REST) |
| Hosting | Vercel (serverless function + static) |
| Category Detection | Keyword matching from product names |

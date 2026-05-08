# PRD: Office Snack Budget Dashboard

## Overview

A Notion-based dashboard to track the "쩝쩝박사" office snack program budget in real-time, replacing manual tracking with automated views that surface budget status, spending trends, and purchase history.

## Background

### Current State
- **Program**: "쩝쩝박사" — 2-person rotation, 2-3 month terms (currently 8대)
- **Budget**: ₩1,500,000/month for Office Snacks (separate budgets for Bi-weekly, Happy Hour, etc.)
- **Data source**: Notion DB with fields: 상품명, 구매일, 가격, Event, 구매처
- **Purchase channels**: 스낵24 (weekly Wednesday orders), 쿠팡, 네이버, 배달의민족
- **Pain points**:
  - No real-time budget remaining visibility
  - No month-over-month or per-capita comparison
  - Manual receipt entry is tedious

### Users
| User | Role | Need |
|------|------|------|
| Shihyun Lee | APAC People Ops Coordinator | Budget monitoring, spending oversight |
| Sunjae | People Ops | Budget management, approval decisions |
| 쩝쩝박사 담당자 | Snack purchasers (rotating) | View past purchases, check remaining budget |

## Goals

1. **Instant budget visibility** — Know how much of the monthly ₩1.5M remains at a glance
2. **Spending trend analysis** — Compare month-over-month and across 쩝쩝박사 generations
3. **Category balance** — Ensure variety across snack types (과자/음료/과일/계절간식)
4. **Purchase history access** — 쩝쩝박사 can easily look up what's been ordered before

## Requirements

### P0 — Must Have

#### 1. Budget Gauge (예산 잔액 게이지)
- **What**: Visual gauge showing current month's Office Snacks spending vs ₩1,500,000 budget
- **Details**:
  - Auto-filter to current month + "Office Snacks" event only
  - Show: spent amount / budget / remaining amount
  - Color coding: Green (0-70%), Yellow (70-90%), Red (90%+)
  - Bi-weekly and other events are excluded from this gauge
- **Data**: Sum of `가격` where `Event = Office Snacks` and `구매일` = current month

#### 2. Monthly Spending Trend (월별 지출 추이)
- **What**: Bar/line chart showing Office Snacks spending by month
- **Details**:
  - Last 6-12 months view
  - Label each period with 쩝쩝박사 generation (e.g., "7대", "8대")
  - Budget line overlay at ₩1,500,000 (₩1,250,000 for older periods)
  - Highlight months that exceeded budget
- **Data**: Monthly sum of `가격` where `Event = Office Snacks`

### P1 — Should Have

#### 3. Category Breakdown (간식 종류별 비중)
- **What**: Pie/donut chart showing spending by snack category
- **Details**:
  - Categories: 과자/스낵, 음료, 과일, 계절간식, 기타
  - Requires adding a `카테고리` field to the existing Notion DB (or tagging within 상품명)
  - Monthly view with filter
- **Note**: Needs a new property in the DB — consider `Category` select field

#### 4. Purchase History Search (구매 이력 검색)
- **What**: Searchable, filterable table view of all past purchases
- **Details**:
  - Filter by: 쩝쩝박사 generation, month, event type
  - Sort by: date, price
  - Accessible to 쩝쩝박사 담당자 (read-only)
- **Data**: Full DB, "전체 내역" view already partially exists

### P2 — Nice to Have

#### 5. Per-Capita Cost (인당 비용)
- **What**: Monthly snack cost divided by office headcount
- **Details**:
  - Requires a headcount input (manual or linked to HR data)
  - Show trend over time
  - Useful for benchmarking as office grows/shrinks

## Data Model Changes

### Existing Fields (no change)
| Field | Type | Example |
|-------|------|---------|
| 상품명 | Text | 스낵24 - 3월 정산 |
| 구매일 | Date | April 10, 2026 |
| 가격 | Number | ₩803,859 |
| Event | Select | Office Snacks / Bi-weekly |
| 구매처 | Select | 스낵24 / 쿠팡 / 네이버 / 배달의민족 |

### New Fields (proposed)
| Field | Type | Purpose |
|-------|------|---------|
| 카테고리 | Select | 과자/스낵, 음료, 과일, 계절간식, 기타 |
| 쩝쩝박사 대수 | Select | 1대 ~ 8대 (auto by date or manual) |

### Budget Reference
| Generation | Period | Monthly Budget |
|------------|--------|---------------|
| 1대 | Jun-Aug 2024 | ₩500,000 → ₩1,250,000 |
| 2대-7대 | Oct 2024 - Mar 2026 | ₩1,250,000 |
| 8대 | Apr-Jun 2026 | ₩1,500,000 |

## Implementation Notes

### Notion-native approach (recommended)
- Use Notion's built-in charts (launched 2024) for gauge and trends
- Formulas for budget remaining calculation
- Linked database views with pre-set filters for each dashboard section
- No external tools needed — keeps everything in the existing Notion workspace

### Alternative: External tool
- If Notion charts are too limited, consider Google Sheets with Notion sync
- More flexible charting but adds maintenance overhead

## Success Metrics

- 쩝쩝박사 can check remaining budget in < 5 seconds (vs. manual calculation)
- Month-end budget overrun reduced (visible early warning)
- No more "how much did we spend this month?" Slack questions

## Timeline

| Phase | Scope | Est. Effort |
|-------|-------|-------------|
| Phase 1 | Budget gauge + monthly trend | 2-3 hours |
| Phase 2 | Category breakdown + history search | 2-3 hours |
| Phase 3 | Per-capita cost | 1 hour |

## Open Questions

1. **카테고리 분류 기준** — 기존 데이터에 카테고리를 소급 적용할 건지? 아니면 앞으로만?
2. **예산 변동 히스토리** — 50만원 → 125만원 → 150만원 변동을 차트에 어떻게 반영?
3. **이벤트별 예산** — Bi-weekly, Happy Hour 등의 예산도 별도 추적 필요?
4. **스낵24 자동 연동** — 위펀 앱에서 데이터 export가 가능한지 확인 필요

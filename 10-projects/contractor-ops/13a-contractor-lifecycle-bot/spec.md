# Contractor Lifecycle Slack Reminder — Build Spec

## Overview

Scheduled agent that reads the Contractor Lifecycle Google Sheet and delivers Slack reminders in two modes: a daily morning digest and real-time pings for new requests.

## Data Source

- **Google Sheet** (auto-populated from Google Form)
- Required columns: contractor name, request type (onboarding/extension/offboarding/rate change), start date, end date, manager name, request date, current status

## Delivery Mode 1: Morning Digest (9am KST daily)

Slack DM grouped by urgency. Each contractor appears **once** in their highest-priority bucket. Tagged with **(New!)** if a request was submitted since the last digest.

### Format

**🔴 Needs Attention**

> **Yuki Tanaka** (New!) — managed by Alex Chen
> Extension / Current contract ends Apr 24 (5 working days)
> New period: May 1 → Jul 31

> **John Kim** — managed by Sarah Park
> Onboarding / Starts Apr 23 (⚠️ 3 working days — late request)

**🟡 Coming Up**

> **Wei Lin** — managed by Jamie Choi
> Onboarding / Starts Apr 30 (10 working days)

**🟢 New Requests**

> **Taro Suzuki** (New!) — managed by David Kim
> Rate Change / Submitted today

### Grouping Rules

- Each contractor appears once, in their highest-priority bucket
- Priority order: 🔴 > 🟡 > 🟢
- (New!) tag added regardless of bucket if request submitted since last digest

### Bucket Criteria

| Bucket | Criteria |
|--------|----------|
| 🔴 Needs Attention | End date within 7 working days / Onboarding with < 7 working days lead time |
| 🟡 Coming Up | Start date within 7 working days / End date within 14 working days |
| 🟢 New Requests | Submitted since last digest, no other urgency |

## Delivery Mode 2: Real-time Ping

- **Trigger:** New row detected in Google Sheet (poll every ~30 min)
- **Message:** Short notification with contractor name, request type, start/end dates, manager
- **Channel:** Slack DM

## Thresholds

| Signal | Threshold |
|--------|-----------|
| End date approaching | 7 working days |
| Start date approaching | 7 working days |
| Late request flag (⚠️) | Request date to start date < 7 working days |
| Early heads-up | 14 working days |

## Implementation

- **Scheduled agent** via `/schedule` — cron at 9am KST for digest
- **Polling agent** — runs every ~30 min, checks for new rows since last run
- **Integrations:** Google Sheets (read), Slack (send DM)
- **Working days calculation:** Exclude weekends (Sat/Sun). Public holidays TBD.

## Out of Scope (for now)

- Writing back to the Sheet
- DocuSign / Deel integration
- Notion Tracker integration
- Email template generation

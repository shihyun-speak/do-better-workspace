# Contractor Lifecycle Bot

Slack bot that reads the Contractor Lifecycle Google Sheet and posts a daily digest of contractor lifecycle events grouped by urgency, with country-based owner routing.

> Front door for this folder. See [`spec.md`](spec.md) for the original design, [`status.md`](status.md) for the current deployment, [`next-iteration.md`](next-iteration.md) for the ticketing direction. The web UI over the same sheet is a separate product at [`../13b-contractor-lifecycle-dashboard/`](../13b-contractor-lifecycle-dashboard/).

## What the bot does

Reads these tabs from the Google Sheet (`1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM`):

| Tab | Used for |
|---|---|
| `[SoT] Contractor Tracker` | Active contractors with end dates |
| `Onboarding` | New contractor start/end dates |
| `Extension` | Contract extensions (new end dates) |
| `Offboarding` | Contractor offboarding |
| `Rate Change` | Payment rate changes |
| `Form Responses` | Submission timestamps for new-request detection |

Posts a Slack digest grouped by urgency. Each contractor appears once in their highest-priority bucket, with a `(New!)` tag if their request landed since the last digest.

| Bucket | Criteria |
|---|---|
| 🔴 Needs Attention | End/start dates ≤ 7 working days, late onboarding requests |
| 🟡 Coming Up | 7–14 working days, new Extension/Offboarding/Rate Change requests |

Within each bucket, entries are sorted by owner:

- **Shihyun (APAC)**: Japan, Korea, Taiwan, Singapore, Hong Kong, China, Philippines, Vietnam, Thailand, Indonesia, Malaysia, India, Australia, New Zealand
- **Hemmi (US + RoW)**: everything else
- **Country unknown**: both tagged

Edit the `APAC_COUNTRIES` set in `contractor_reminder.py` to adjust routing.

## Where it runs

**Production**: GitHub Actions in [`shihyun-speak/contractor-lifecycle-bot`](https://github.com/shihyun-speak/contractor-lifecycle-bot)

- Schedule: daily 9am KST (00:00 UTC) via `.github/workflows/digest.yml`
- Manual trigger: GitHub → Actions → Daily Digest → Run workflow
- Secrets in GitHub repo settings: `SLACK_WEBHOOK_CHANNEL`, `GOOGLE_SA_KEY_JSON`
- Posts via the "Contractor Bot" Slack webhook

**Local fallback**: skill at `.claude/skills/contractor-lifecycle-reminder/` — same script, runs against `gws` CLI auth and the local service account JSON. Kept as a safety net while the hosted version stabilizes.

**Not running** (on purpose):

- Real-time 30-min polling for new requests (was in the original spec). Vercel Hobby caps at 1 cron/day; GitHub Actions could do it but the daily digest's `(New!)` inline tag covers the same need.
- Vercel deployment — tried and dropped (Hobby cron limits + brittle Python runtime setup).

## How we patched it up

Three commits since the initial build, in order:

### 1. `711ab8d` — initial feature (2026-04-17)

First working version: `contractor_reminder.py` + `SKILL.md`. Date lookup across all tabs, submitter field, quoted block format, configurable lookback window for remote triggers.

### 2. `c7d283a` — make it deployable remotely (2026-04-20)

The big one — needed so the bot could run off the laptop.

- **Google service account JWT auth** (RS256) via `cryptography` lib with an `openssl` CLI fallback, so Sheets API works without `gws` CLI in CI
- **Webhooks moved out of code** into `SLACK_WEBHOOK_DM` / `SLACK_WEBHOOK_CHANNEL` env vars (no more hardcoded secrets)
- Renamed `MANAGER_SLACK_IDS` → `SLACK_IDS`, added more name aliases (Ekaterina/Katya, Alexandra OJ variants)
- Reworded line formats: `Contract ends X — N working days left` instead of `End date approaching · N working days`
- New Extension/Offboarding/Rate Change requests promoted from green bucket to **yellow**; the separate green section was dropped — `(New!)` tag is now inline in the existing buckets

### 3. `62fdc78` — extension delta clarity (2026-04-20)

When a new Extension request arrives, the alert now shows `Current end date X → new end date Y` by cross-referencing the SoT tab. Saves a click into the sheet to figure out what's actually changing.

## Files in this folder

- `README.md` — this doc
- `spec.md` — original build spec
- `status.md` — what's live right now
- `next-iteration.md` — ticketing-system direction (idea / pre-spec)
- `shihyun-gws-250436643995.json` — local service account key (do not commit)

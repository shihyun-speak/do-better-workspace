# Contractor Lifecycle Reminder — Status

> Quick reference for the current state of the bot. See `spec.md` for the original design and `next-iteration.md` for future direction.

> **2026-11-09: RETIRED.** The `Daily Digest` workflow in `shihyun-speak/contractor-lifecycle-bot` was disabled (`gh workflow disable`) after it kept posting a second, stale digest alongside the live bot. The live bot is `speak-peopleops/peopleops-automations` (`contractor-reminder.yml`). Re-enable only if that one is shut down.

## What's live (2026-04-30)

**Runtime**: GitHub Actions (not Vercel — we tried Vercel but Hobby plan blocked the 30-min polling and Python runtime setup was brittle)

- **Repo**: https://github.com/shihyun-speak/contractor-lifecycle-bot
- **Schedule**: every 6h via `.github/workflows/digest.yml` (`cron: 7 */6 * * *`); a guard step skips firings after the day's first successful run, so the digest still posts once/day. Cron drift on a single daily firing dropped runs on 2026-04-28 and 2026-04-29; the every-6h pattern is the failsafe.
- **Manual trigger**: GitHub → Actions tab → Daily Digest → Run workflow (always sends, bypasses the guard)
- **Slack destination**: webhook-based, posts via "Contractor Bot"
- **Secrets stored in**: GitHub repo settings (`SLACK_WEBHOOK_CHANNEL`, `GOOGLE_SA_KEY_JSON`)

## Current digest format

- Grouped by urgency: 🔴 Needs Attention / 🟡 Coming Up
- Within each bucket, split into owner sub-sections:
  1. APAC countries → Shihyun
  2. US + RoW → Hemmi
  3. Country unknown → both tagged
- Each owner group has an italicized sub-header with the @ mention
- Within an owner sub-section, entries sort by **working days left ascending** (most urgent on top); ties break alphabetically
- Each entry shows `Invoice Approver:` from SoT's `Contractor Invoice Approver` column (not the form-side manager)
- Dates render with the year when not in the current calendar year (so 1-year contracts don't look same-day)

## Owner routing

- **Shihyun (APAC)**: Japan, Korea/South Korea, Taiwan, Singapore, Hong Kong, China, Philippines, Vietnam, Thailand, Indonesia, Malaysia, India, Australia, New Zealand
- **Hemmi (US + RoW)**: everything else
- Edit `APAC_COUNTRIES` set in `contractor_reminder.py` to adjust

## What's NOT live

- **Team collaboration** — considered sharing the bot with Hemmi, but abandoned (local skill + hosted digest is enough)

## Real-time new-request alerts

Apps Script `onFormSubmit` trigger bound to the Google Sheet — fires the moment the contractor request form is submitted, posts to the same Slack webhook. Lives in the Sheet itself (no GitHub Actions cron involved, no drop risk).

- **Code**: `apps-script-new-request-alert.gs` in this folder
- **Status**: deployed and posting; owner routing pulls country from the submission row (col H), not SoT, so new contractors route correctly even before they land in the tracker
- **Setup steps**: see comment block at the top of the .gs file
- **Why not GitHub Actions every 30 min**: same drift/drop failure mode that hit the daily digest — using the same infrastructure for higher-frequency alerts amplifies the problem

### Pending: per-request-type date context

Drafted but **paused before deployment**. Goal: include the relevant dates inline in each new-request alert:

| Request type | Date line |
|---|---|
| Onboarding | `Contract period: <start> → <end>` |
| Extension | `Current end date <prev> → new end date <new>` (prev pulled from `[SoT] Contractor Tracker`) |
| Offboarding | `Ends <date>` (with `(originally <date>)` if different) |
| Rate change | `Effective <date>` |

The draft lives in `apps-script-new-request-alert.gs` (functions `dateLinesFor_`, `lookupSotEndDate_`, plus the `COL` index map). Risk before turning it on: form column indices may have shifted — there are duplicate "Column 25" headers in the form layout that suggest reordering. Need to verify against a real test submission before paste-and-deploy.

## Parallel running

The original local skill at `.claude/skills/contractor-lifecycle-reminder/` still works. Keep it running for ~1 week as a safety net. If GitHub Actions fires reliably at 9am KST, retire the local one.

## Recent changes

- **2026-05-08**: Unified country tags in the digest. Free-form values from the form (`California, US` / `New York // United States` / `South korea` / bare US state codes like `CA`) collapse to ISO-style tags (`US-CA`, `US-NY`, `KR`). Bare 2-letter US state codes are interpreted as US states (Speak's sheet uses `CA` to mean California, not Canada). Uncertain values like `to be provided during the process (Spain or Armenia)` pass through unchanged so the reader sees the ambiguity. Lives in `normalize_country()` in `contractor_reminder.py`; deployed via commit `67987eb` after a brief detour where `e01a87c` reordered body lines to lead with urgency — reverted because the original layout reads better in practice.
- **2026-04-30**: Pulled six months of local-skill changes back into the deployed bot (commit `1b7e86a`). Headlines: status-based filters across all four request tabs (catches `Pending` / `Action Required` / blanks); Extension urgency anchored on the prior end date (last Active Extension or Onboarding) instead of SoT, since SoT pre-updates the moment a request is filed; Invoice Approver replaces "Managed by" line; year-aware date format; sort by working-days-left within each owner sub-section; `min oh` → `minjin oh` alias added. Verified production via manual workflow_dispatch. Scheduled remote agent for 2026-05-01 09:30 KST to check tomorrow's auto-cron actually fires.

## Recent incidents

- **2026-04-30 (am)**: All 3 of today's scheduled runs failed at the new "skip-if-already-sent" guard step — `gh run list` returned HTTP 403 ("Resource not accessible by integration"). Default `GITHUB_TOKEN` in this repo lacked `actions: read`, so the guard couldn't query workflow history and crashed the job before the digest sent. Fix: added explicit `permissions: { contents: read, actions: read }` and `continue-on-error: true` on the guard step so any future query failure fails open (digest sends) rather than silent. Manually fired today's digest.
- **2026-04-28 & 2026-04-29**: GitHub Actions cron drifted (00:07 UTC scheduled → 06–08 UTC actual) then dropped two days in a row. Manually fired the missing 04-29 digest. Root cause: GitHub deprioritizes scheduled events under runner-pool load, no SLA on `schedule:` triggers. Fix: every-6h cron + once-per-day guard (PR #1).

## Links

- [Original spec](spec.md)
- [Next iteration ideas](next-iteration.md) — ticketing system direction
- [GitHub repo](https://github.com/shihyun-speak/contractor-lifecycle-bot)
- [GitHub Actions tab](https://github.com/shihyun-speak/contractor-lifecycle-bot/actions)
- Google Sheet: `1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM`

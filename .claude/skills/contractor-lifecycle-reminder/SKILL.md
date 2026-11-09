---
name: contractor-lifecycle-reminder
description: Contractor lifecycle Slack reminder. Bot now lives in the shared peopleops-automations repo and runs on GitHub Actions. "contractor reminder", "contractor digest", "lifecycle reminder", "contractor check" triggers.
allowed-tools:
  - Bash
  - Read
---

# Contractor Lifecycle Reminder

> ⚠️ **Source of truth has moved.** The real bot lives at:
> `~/Documents/GitHub/peopleops-automations/skills/contractor-lifecycle-reminder/`
>
> It now runs **automatically on GitHub Actions** — Mon-Sat digest from 9am KST + weekday 30-min new-request poll. Your laptop doesn't need to be on.
>
> Edits should be made in the GitHub repo and pushed, not here.

## How the bot runs now

| When | Where | How |
|---|---|---|
| Mon-Sat from 9am KST | GitHub Actions runner | `.github/workflows/contractor-digest.yml`: tries 09:07/11:07/13:07/15:07 KST, first success posts, rest skip (PR #3, Sat added in PR #4) |
| Weekdays every 30 min | GitHub Actions runner | New-request poll in `.github/workflows/contractor-reminder.yml` |
| On-demand (manual) | Your laptop or GitHub UI | See commands below |

## Manual trigger (rare use)

### From your laptop

```bash
cd ~/Documents/GitHub/peopleops-automations
python3 skills/contractor-lifecycle-reminder/scripts/contractor_reminder.py send-digest
```

Other commands:
- `send-digest` — build digest + send to Slack
- `send-new-requests` — check for new requests in last hour + send if any
- `digest` — build digest, print only (no send)
- `new-requests` — check, print only (no send)

Reads from `scripts/.env` (local-only, gitignored). To set this up if missing, copy `scripts/.env.example` to `.env` and fill in the values from 1Password or ask Shihyun.

### From GitHub Actions UI (no terminal needed)

1. Go to https://github.com/speak-peopleops/peopleops-automations/actions
2. Click **Contractor Lifecycle Reminder** in left sidebar
3. Click **Run workflow** button (top right)
4. Pick the command (`send-digest`, `send-new-requests`, `digest`, `new-requests`)
5. Click **Run workflow**

### Via gh CLI

```bash
gh workflow run contractor-reminder.yml -f command=send-digest --repo speak-peopleops/peopleops-automations
```

## Urgency buckets

- 🔴 **Needs Attention** — end dates within 7 working days, late onboarding requests
- 🟡 **Coming Up** — start/end dates within 7-14 working days
- 🟢 **New Requests** — submitted in last 24 hours

## Data source

Google Sheet: `1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM`

| Tab | Purpose |
|-----|---------|
| [SoT] Contractor Tracker | Active contractors with end dates |
| Onboarding | New contractor onboarding (start/end dates) |
| Extension | Contract extensions (new end dates) |
| Offboarding | Contractor offboarding |
| Rate Change | Payment rate changes |
| Form Responses | Timestamps for new request detection |

## Old scripts/

The `scripts/` folder next to this SKILL.md is **deprecated**. Safe to delete when you're ready:

```bash
rm -rf ~/AI/do-better-workspace/.claude/skills/contractor-lifecycle-reminder/scripts
```

Use the version in the GitHub repo instead.

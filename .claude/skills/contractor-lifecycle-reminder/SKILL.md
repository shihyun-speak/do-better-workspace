---
name: contractor-lifecycle-reminder
description: Contractor lifecycle Slack reminder. Reads Google Sheet, sends morning digest and new request alerts via webhook. "contractor reminder", "contractor digest", "lifecycle reminder", "contractor check" triggers.
allowed-tools:
  - Bash
  - Read
---

# Contractor Lifecycle Reminder

Sends a Slack digest of contractor lifecycle events via webhook (Contractor Lifecycle Bot).

## Commands

| Command | What it does |
|---------|-------------|
| `send-digest` | Build digest + send to Slack |
| `send-new-requests` | Check for new requests in last hour + send if any |
| `digest` | Build digest, print only (no send) |
| `new-requests` | Check new requests, print only (no send) |

### Send digest to Slack

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/contractor_reminder.py send-digest
```

### Check & send new requests

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/contractor_reminder.py send-new-requests
```

## Urgency buckets

- 🔴 **Needs Attention** — end dates within 7 working days, late onboarding requests
- 🟡 **Coming Up** — start/end dates within 7-14 working days
- 🟢 **New Requests** — submitted in last 24 hours

## Scheduled use

- **Daily digest**: weekdays 9am KST
- **New request polling**: every 30 min on weekdays

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

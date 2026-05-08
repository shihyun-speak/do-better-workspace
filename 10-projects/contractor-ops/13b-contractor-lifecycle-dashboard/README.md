# Global Contractor Dashboard

Web UI (Next.js on Vercel) over the Contractor Lifecycle Google Sheet — filterable tables for Active Roster, Onboarding, Extension, Offboarding, and Rate Change requests, with status write-back.

> See [`progress.md`](progress.md) for build history, deployment details, and known gaps. The Slack digest bot that reads the same sheet lives at [`../13a-contractor-lifecycle-bot/`](../13a-contractor-lifecycle-bot/) — same data source and owner routing, but it pushes to Slack instead of rendering a UI.

## What it shows

Six tabs across the top:

| Tab | What's in it |
|---|---|
| **Active Roster** | `[SoT] Contractor Tracker` minus Ended/Voided rows |
| **Onboarding** | Open Onboarding requests (status not Active/Ended/Void) |
| **Extension** | Open Extensions, with prior-end → new-end dates |
| **Offboarding** | Open Offboarding requests |
| **Rate Change** | Open Rate Change requests |
| **Inactive** | Ended/Voided rows + expired contracts + `#N/A` data errors |

Filters: owner (APAC / RoW / Unknown / All), free-text search. Status dropdowns on every row write back to the sheet.

See [`progress.md`](progress.md) for the full feature inventory, status-pill palette, and access-control notes.

## Run locally

```bash
cd 10-projects/13b-contractor-lifecycle-dashboard
npm install

# Put the same service-account JSON the bot uses into .env.local:
#   GOOGLE_SA_KEY_JSON='{"client_email":"...","private_key":"-----BEGIN..."}'
# (single-line JSON, \n inside private_key kept as literal \n — the loader normalizes it)
cp .env.example .env.local
# …then fill in GOOGLE_SA_KEY_JSON

npm run dev
# → http://localhost:3000
```

The SA must have read access to the spreadsheet. The same key file at `../13a-contractor-lifecycle-bot/shihyun-gws-250436643995.json` works — paste its contents (one line) into `GOOGLE_SA_KEY_JSON`.

## Deploy to Vercel

```bash
cd 10-projects/13b-contractor-lifecycle-dashboard
vercel link        # link to a new project
vercel env add GOOGLE_SA_KEY_JSON   # paste single-line JSON
vercel --prod
```

Production also requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `SLACK_AUTH_ALERT_WEBHOOK` for the NextAuth Google sign-in gate — see [`progress.md`](progress.md) for the full env-var list and deploy steps.

## Architecture & files

See [`progress.md`](progress.md) — the data-flow diagram and per-file purpose table live there so they don't drift between two docs.

## Why this exists

The Slack digest is great for "what needs attention today" but bad for browsing. People Ops sometimes want to ask "who's our active roster in Japan right now?" or "what extensions are still open?" — questions the bot doesn't answer well. The Sheet does, but the UI is rough.

This dashboard is the read-only visual layer. Future iterations may add:

- Ticket state per request (see [`../13a-contractor-lifecycle-bot/next-iteration.md`](../13a-contractor-lifecycle-bot/next-iteration.md))
- Quick links into Deel / DocuSign / Notion
- Owner-scoped views or magic links

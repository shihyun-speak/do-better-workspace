# Next Iteration — Ticketing System

> Status: Idea / pre-spec
> Parent project: [Contractor Lifecycle Reminder](spec.md)

## The problem with the current reminder

Slack reminders are one-shot pings. Once a new request is announced, there's nothing persistent to track:

- Is the request still open, or has it been processed?
- Which step is it stuck on (contract sent / signature pending / Deel upload)?
- Did someone else already action it, or is it waiting on me?

Today this lives in my head + the Google Sheet's "Status" column, but the reminder bot doesn't know about state — it just announces and moves on.

## The idea — merge into one system

Instead of treating the Slack bot and contractor tickets as two separate things, **each new contractor request becomes a ticket the bot tracks through its lifecycle**.

**Flow:**
1. New request hits Google Form → ticket auto-created
2. Bot posts to `#global-contractor-dashboard` with ticket link/ID
3. Ticket moves through stages (requested → contract sent → signatures → Deel → active)
4. Daily digest only shows **open tickets** needing action, not everything
5. Bot auto-closes tickets when it detects state change in the Sheet (e.g., "Active" status)

## Open questions (to answer before spec'ing)

### 1. Where do tickets live?

Three options:

| Option | Pros | Cons |
|--------|------|------|
| **Google Sheet** (new columns in existing tracker) | Already the SoT, no new system | Limited UI, hard to comment/collaborate |
| **Notion database** | Good UI, comments, filters, views | Another sync point; the Sheet is still where Form data lands |
| **Linear / Jira** | Purpose-built for tickets | Overkill; People Ops isn't on these tools |

Leaning: **Notion DB** synced from the Sheet, since the team already lives in Notion and it fits the existing Onboarding/Offboarding Tracker pattern.

### 2. What statuses matter?

Current Sheet statuses (SoT tab): `Active / Ended / Ending soon / Onboarding / Voided`

For tickets, something more granular:
- **Requested** (form just submitted)
- **Contract Sent** (DocuSign out)
- **Awaiting Contractor Signature**
- **Awaiting Manager Signature**
- **Signed**
- **Deel Uploaded**
- **Tool Onboarded**
- **Active** (→ auto-close)
- **Extension Pending Decision**
- **Offboarding In Progress**
- **Ended** (→ auto-close)

These already appear in the original spec (spec.md → Problem A → Dashboard → Status values).

### 3. Who updates tickets?

- **Manual**: I update status as I progress each step
- **Auto from Sheet**: Bot watches Sheet, updates ticket when Sheet's status column changes
- **Auto from external systems**: Bot hits DocuSign API to detect signatures, Deel API for upload

Most realistic v0: **manual updates by me** + **auto-close when Sheet goes Active/Ended**. API integrations (DocuSign/Deel) are the stretch goal — same concern flagged in spec.md's Constraints section.

### 4. What does the digest change to?

Instead of "what came in recently," digest shifts to **"what tickets need my attention today"** — grouped by stage (awaiting signature, awaiting Deel, etc.), not by date.

That's closer to the original **dashboard vision** from the AX 기획서 (Tool 1: Contractor Lifecycle 대시보드) — which was "Build now" priority but got deferred because the Sheet already served as a lightweight dashboard.

## Why this now

- Reminder bot proved out the delivery channel (Slack + webhook + scheduled triggers)
- Now that alerts are working, the next friction is **follow-through** — "I saw the ping but then what happened?"
- Tickets bridge the gap between "something was requested" and "something got done"

## Next step (when ready to build)

1. Pick storage (Notion DB vs Sheet columns) — decide by trying to mock one up in Notion
2. Define status values + transitions (use spec.md list as starting point)
3. Extend the bot's Python script to read/write tickets (not just read the Sheet)
4. Redesign digest around open tickets vs recent submissions
5. Parallel: scope DocuSign/Deel API integrations (the Constraints from spec.md — "Deel 공개 API 여부 확인 필요")

## Related

- Original project spec: [spec.md](spec.md)
- Current status: [status.md](status.md)
- AX 기획서 — Tool 1 (대시보드) + Tool 2 (Flow Runner) both fold into this
- Current bot code: https://github.com/shihyun-speak/contractor-lifecycle-bot (hosted)
- Local skill (fallback): `.claude/skills/contractor-lifecycle-reminder/`

# Q4 2026 / Q1 2027 Planning: Progress

> Notion is the source of truth: [SH Q4-Q1](https://app.notion.com/p/usespeak/Q4-Q1-400792ec2f10800c8440c9d16342f217) (page id `400792ec2f10800c8440c9d16342f217`, on the **snack** integration, use the snack token, Notion-Version `2026-03-11`). Local OKR draft: [`q4-q1-okr.md`](q4-q1-okr.md). Parked feasibility / tool notes: [`new-tools-feasibility-notes.md`](new-tools-feasibility-notes.md).
> Last updated: 2026-11-25
> Stage: **design** (what we aim to do). Feasibility gets explored later.

## Start here next time

**SH Q4-Q1 AI toggle simplified (2026-11-24).** The "Using AI to accelerate POps work" toggle in SH Q4-Q1 went from ~185 blocks to: Goal & KR (unchanged) → link to the AI Acceleration page → A. Partial automations table (Flow | Target | Live now | Next) → B. New tools table (Tool | Aim | Status | Next) → collapsed "💎 Retention tracker: design notes" toggle (the 7 detail toggles, copied verbatim). Removed: the 8-column A/B tables and the Hojicha v2 toggle (restore from Notion page history if needed). New block ids start with `422792ec`.
- **Pick up with:** Shihyun to sanity-check the "Live now" / "Next" cells (esp. offboarding "Not yet"). When a step ships, update this summary table, the AI page toggle tables and the tracker DB together.
- How it was done: Notion REST via the snack token; blocks can't be moved via the API, so they were recreated + old ones deleted. Watch for `icon: null` in copied block payloads (strip None fields before re-creating).
- Git: the `10-projects/2026-planning/` folder (4 files) was committed for the first time on 2026-11-25 (`e2404b0`) and pushed to GitHub with the 7 earlier local commits; `main` matched `origin/main` after the push.

**AI Acceleration team page (2026-11-17).** Team-facing overview, child of SH Q4-Q1: [AI Acceleration (WIP)](https://app.notion.com/p/AI-Acceleration-41b792ec2f10812fb779fe06303d5d7e) (page `41b792ec-2f10-812f-b779-fe06303d5d7e`, snack token). Shihyun edits it in parallel: re-read before writing.
- Layout: "Why we're doing this?" callout (Q4/Q1 key result, scope, problem, APAC alignment, per-flow targets) → TOC → **1️⃣ The Roadmap**: 3 toggle headings, each with a Status | Item | Notes table (🧾 Contractor lifecycle, 7 items; 👋 FTE on/offboarding (Bloop) with the Bloop page in a callout + Onboarding 6 / Offboarding 4 tables; 💡 Not started yet: retention tracker, onboarding hub, Level / Comp, owner handoffs) → **2️⃣ Tracker**: inline DB "Roadmap tracker" (data source `41b792ec-2f10-8153-ba57-000ba33b8f89`; Step, Project, Status, Workstream, Quarter, Note; 23 rows; views "By project" = table grouped by Project, "Board" = by Status) → **3️⃣ Sub-docs** (Hojicha, SH Q4-Q1).
- The Bloop page `40d792ec2f108088b11ffa5803959286` now lives inside this page (Shihyun placed it in the FTE toggle).
- Keep toggle tables and tracker rows in sync when a step ships. Status words: Live / Iterating / Waiting / Planned / Later / Idea / Prototype (tracker uses Live / In progress / Waiting / Planned / Idea).
- 8 trashed duplicate tracker rows sit in Notion trash (from an interrupted edit); safe to empty.
- Claude Doc draft deleted 2026-11-17 (Notion is the only copy).

**Earlier tracks (2026-10-28):**

**1. Contractor dashboard redesign (Hojicha v2), section A.** Full build state: `../contractor-ops/13b-contractor-lifecycle-dashboard/progress.md`. Prototype: https://claude.ai/artifact/LSNnZ3CBg2oSQPCekspikS
- **Live at `speak-ctr-hojicha.vercel.app/v2`:** Open items (4 request tabs with stages + checklists, refined step names, Copy message for IT on onboarding setup + offboarding access, Ending soon nothing filed), profile panel (all Form Responses answers, toggles), default view All → Open items → Onboarding. DocuSign signed → auto-ticks "Contract signed by all" / "New contract signed" / "Amendment signed" (tagged Automatic). SoT status cron verified 10/28. `/` is still the old dashboard.
- **Pick up with:** (a) confirm the first real signed envelope ticks itself + logs; (b) teammate feedback (Slack draft sent to Shihyun's DM, she posts it); (c) Phase 3 Roster timeline, Phase 4 Automations, Phase 5 switch-over; (d) Shihyun to push branch `feat/automation-log` (peopleops-automations) + PR; (e) optional: add "systems the contractor had access to" to the IT offboarding message.

**2. Top performer retention tracker, section B.** v0 prototype (sample data): https://claude.ai/artifact/E5hYa1ftdxo2LVUiycqW75
- Shihyun's direction (10/28): red / amber / green indicator; measures listed with weights and the points each adds; tools = action plans with trigger buttons that open drafts (Slack to manager, calendar invite, HRBP comp request, stay-interview guide); final button creates the action plan as a Notion doc.
- Prototype defaults: pay stagnation 30 (6→15 mo), time in title 20 (12→30 mo), manager change 25 (within 6→3 mo), team pulse drop 25 (3→15 pts); red ≥ 60, amber ≥ 35. Views: Attention list, Review (quarterly rollup + monthly digest), Measures & weights (editable), Proposal; View as People Ops / Leadership / Manager / Employee.
- **Pick up with:** her feedback on the prototype; then decide whether to update the Notion page section B to match (weighted score replaces 'no score at first')

## Notion page structure (current)

1. **Using AI to accelerate POps work** (simplified 2026-11-24; detail lives in the AI Acceleration page)
   - **Goal & Key Result** callout + Scope / Problem / APAC alignment bullets (unchanged)
   - Link line to [SH] POps AI Acceleration (live status, roadmap, tracker)
   - **A. Partial automations**: one table, Flow | Target | Live now | Next (onboarding / offboarding / contractor)
   - **B. New tools**: one table, Tool | Aim | Status | Next (retention tracker / onboarding hub / Level-Comp)
   - **💎 Retention tracker: design notes** toggle: the 7 detail toggles (predictors, views + actions, access + build, weighting + open questions, HiBob data check, prototype v0, review + ideas)
   - Removed: the 8-column A/B tables and the Hojicha v2 toggle (duplicated in the AI page + Hojicha doc). Backup JSON of the old toggle was saved to the session scratchpad only; Notion page history also has it.
2. **APAC Employee Events** (toggle): goal (80%+ participation), Halloween (Oct 29), year-end party (Dec 11 or 12)
3. **Generalist Onboarding** (toggle): goal, Week 1 / Days 1-30 / Days 30-90

## A. Partial automations

| Flow | Unit | Target | Automations |
|---|---|---|---|
| Employee onboarding | offer signed → Day 1 ready | -30% | Owner handoffs after offer accepted; probation alert; new hire survey reminders; 1:1s at D+20 / D+50 |
| Employee offboarding | notice received → access removed + payroll closed | -20% | Access-removal scheduling; checklist audit |
| Contractor lifecycle | form submitted → Deel setup done | -20% | Sheet → DocuSign (Q4, see `../contractor-ops/13c-docusign-contract-automation/`); onboarding / extension / offboarding email templates |

## B. New tools

### 💎 Top performer retention tracker
- **Concept:** flag + action plan system (follow-through on top talent investment, not prediction). HiBob data → flags → Watch / Act → action plan (owner, due) → Slack nudge → outcome; rules tuned over time
- **v1 flags:** pay stagnation (time since last salary change), time in title, manager change, team pulse drop. More candidates in Notion (review trend, team exits, engagement items, no career chat, no time off, tenure / vesting)
- **Weighting:** no score at first; 1 flag type = Watch, 2+ = Act; a few strong single flags = Act; tune quarterly
- **Build: secure website** (not Notion / Sheets: comp-adjacent data)
  - **v0 (Q4):** clickable prototype with fake data, used as the proposal to manager
  - **v1:** real HiBob data + flags, view-only for POps
  - **v2:** action plans, Slack nudges, manager access
- **Security:** Google sign-in allowlist + roles; store flags not raw salary; access log; read-only HiBob API user with limited fields; host on a company-managed account with IT / security sign-off (not personal Vercel)
- **Access:** leadership + HRBP see all; managers see their reports' actions only; employees never see flags; POps main user to start

### 🧭 Team-level onboarding hub
- Role hub + tailored 30/60/90 + Q&A tool + check-ins; pilot POps team first (with the Generalist), then CSM (sources: Jiwon, Sumin, Michelle)

## HiBob findings (read-only field check, 2026-10-23)

- **Available:** time since last salary change; work history (title, department, subteam, reports-to, change type, effective dates); start date / tenure; termination date + lifecycle status; time off; performance cycles; 1:1 Meetings; Development Plans; equity table
- **Gaps / to confirm:** no termination reason or regretted field; org level history unclear (may be current only); vesting dates may be text only ("Offer Letter Equity"); survey anonymity settings not visible via the connector
- **Surveys at Speak:** pulse, engagement (use team level), new hire 30/60/90 (named; better fit for the onboarding hub)

## HiBob data check for the retention tracker (2026-10-28, read-only, field lists + Shihyun's own record only)

| Measure | Status | Source |
|---|---|---|
| Pay stagnation | ✅ | `/payroll/timeSinceLastSalaryChange` (period, no amount) |
| Time in title | ✅ | Work history table (`work`): rows with `effectiveDate`, `title`, `reportsTo`, change reason |
| Manager change | ✅ | Work history `reportsTo` changes |
| Team pulse drop | ⚠️ | Surveys filterable by department / subteam / reports to / site, anonymity "standard". Last pulse = Q4'25 (Oct 2025); since then only annual engagement (May 2026). Needs quarterly pulses to work |
| Great / pivotal list | ❌ | No field. Needs a new restricted HiBob field (e.g. "Talent tier") or a restricted Sheet + an owner |
| Org level history | ⚠️ | `/employee/orgLevel` is current only, not in work history: no level history |

Caveats: (1) pre-HiBob history may be a single "import" row (Shihyun's own record has an "import" row dated 2024-12-02), so time in title could be understated for long-tenured people; confirm with one long-tenured record or whoever set up HiBob. (2) Checked with Shihyun's user access; the v1 read-only API user must be limited to time-since-salary-change only (payroll category), confirm with HiBob admin / IT.

## Decisions

- Design stage: aims and structure first, feasibility later
- AI plan split into **A. Partial Automations** (key result) and **B. New Tools** (talent focus)
- AI plan scoped to all APAC, not just KR; new tools designed for global, piloted in APAC
- Key result changed from survey ("my team can deliver faster", +10%) to time per task
- Retention tracker = flag + action plan system on a secure website, not a prediction model
- 2026-10-28: weighting changed to a weighted score (measures with weights → red / amber / green), per Shihyun
- Page format: short visible summary, details in toggles, detailed tables welcome, no sub-pages

## Open items

- [ ] Retention tracker open questions: who owns the Great / pivotal list; pulse / engagement anonymity + min group size; where termination reasons / regretted exits are tracked; org level history; whether managers use HiBob 1:1 Meetings / Dev Plans
- [ ] Next build candidate: retention tracker v0 prototype with fake data (no real data, no approvals needed)
- [ ] Raise hosting with IT early: company-managed account for the retention site
- [ ] Onboarding unit mismatch: 3 of 4 onboarding automations are post-Day 1 but the unit ends at Day 1. Extend unit (to D+50 / probation end) or treat them as nice-to-haves
- [ ] Start timing baseline cases across KR / JP / TW (Oct to Nov)
- [ ] Key result mismatch: page callout says -60% + 3 automated steps per flow; per-flow targets say -30 / -20 / -20. Shihyun to confirm
- [ ] Q4 load: most Section A rows moved to Q4 on 10/27 (plus DocuSign); check capacity alongside year-end party + Generalist ramp
- [x] First SoT cron run verified 10/28 08:53 KST: 4 flips, 0 failed, in the automation log
- [ ] Dashboard redesign: Phase 3 Roster → Phase 4 Automations → Phase 5 switch-over (`/v2` → `/`, old at `/classic`)
- [ ] Push reminder-bot logging branch `feat/automation-log` + open PR (push was blocked for Claude)
- [ ] Timeline section was removed from the page outside this session; restore if unintended
- [ ] Events: JP Halloween plan (Oka), final announcement 10/26; year-end budget / date per market early Nov (check Q4 team event budget, tabs still at $100/pp)
- [ ] Generalist: fill start date and ramp owner; agree ownership split (Shihyun vs Generalist)

## Log

- **2026-10-21:** Structured Notion page; filled ideas; added baseline tracker, timeline, details; scoped to APAC; KR wording clarified (key result vs Korea)
- **2026-10-21:** Rebuilt around Shihyun's realistic steps; added Automation Options for discussion; restructured hierarchy
- **2026-10-23:** Added APAC Employee Events (Halloween, year-end) and Generalist Onboarding toggles; saved this progress file
- **2026-10-23:** Moved "Something new" into its own section (retention tracker, team-level onboarding). Added offboarding checklist audit to Automations (Q4)
- **2026-10-23:** Tried sub-pages for the new tools, then removed them (everything stays on the main page)
- **2026-10-23:** AI section split into A. Partial Automations and B. New Tools; detailed feasibility content parked in `new-tools-feasibility-notes.md`
- **2026-10-23:** Section A: one heading + target line + detailed table per flow. Section B matches: heading + aim + table per tool. Timeline section removed outside this session
- **2026-10-23:** Retention tracker explored: flag + action plan system; HiBob field check; predictors, tool views, action menu, weighting, open questions drafted into Notion, then condensed into a concept line + detail toggles
- **2026-10-23:** Retention tracker moved to a secure website plan (v0 prototype with fake data as proposal, v1 view-only real data, v2 actions + nudges + manager access); progress file summary rewritten to match the current page
- **2026-10-27:** Shihyun moved most A rows to Q4, folded D+20/D+50 1:1s into the probation row, added offboarding calendar step, reshaped onboarding hub (sources → generator website → tailored plan), added Level / Comp skeleton. Claude filled notes + before/after for every row, expanded How into steps, added live contractor reminder bot as a done automation, drafted Level / Comp aim + 3 rows (level framework, pay bands, data audit)
- **2026-10-27:** Contractor lifecycle: Shihyun changed email trigger to form submission, added DocuSign template breakdown, added Q1 row 'Add additional functions to the existing dashboard'. Claude filled that row from 13c 'Later' (DocuSign completed webhook → Ready for Deel + Slack ping, Create in Deel button via Deel API, Deel done email)
- **2026-10-27:** Dashboard row reframed per Shihyun as **automatic status tracking** (DocuSign + Deel webhooks → status + timestamps in Sheet, per-contractor timeline, stuck alerts). Timestamps double as key result measurement
- **2026-10-27:** Dashboard row reframed again: Shihyun wants an **automation log** (visible record of what fired / completed), not status tracking. Row now: each automation appends time / automation / flow / person / action / result / link; dashboard Activity tab; Slack ping on failure; Low effort. Open: keep in contractor table or make it cross-flow
- **2026-10-27:** Automation log to live as an 'Activity' tab on the existing contractor dashboard (speak-ctr-hojicha.vercel.app, 13b), one log per automation. Note: employee on/offboarding entries need POps-only visibility (current allowlist includes Sunjae / Hemmi / Mina)
- **2026-10-27:** Started Activity tab build; stopped before code: found dashboard prod = 5/12 deploy, SoT cron + later changes undeployed. Corrected Notion row to 'Partly live'. Reminder bot confirmed running on GitHub Actions
- **2026-10-27:** Hash-compared deployed source vs local: gap is just the cron + owners.ts country matching (earlier '1,500 lines' was vs git, already live)
- **2026-10-27:** Deployed dashboard (cron + country fix), CRON_SECRET set, cron registered. Next: verify first run 10/28, then Activity tab
- **2026-10-27:** Activity tab built (separate log sheet, cron + auto-sync logging, bot logging on branch). Waiting on Shihyun to deploy + push the bot branch
- **2026-10-27:** UI redesign: clickable prototype (fake data) published at https://claude.ai/artifact/LSNnZ3CBg2oSQPCekspikS. Views: Today action queue, Contractors (cards + profile drawer), Requests (one list), Activity. Waiting on Shihyun's feedback before building into 13b
- **2026-10-27:** Prototype v2: requests tabbed by type, each with its own action plan checklist (Onboarding 5 steps, Extension 4, Offboarding 4, Rate Change 3; steps tagged where an automation helps). Plan steps are my draft, need Shihyun's real steps
- **2026-10-27:** Prototype v3: type colors (Onboarding violet, Extension teal, Offboarding magenta, Rate Change orange) on tabs/cards/trigger buttons + 'How it works' flow strip; region selector APAC / US / RoW / All; Activity = all logs (own region/automation/failed/search filters, per-person 'View all logs'). Onboarding steps per Shihyun: Form submitted → DocuSign draft created → Review & send out the contract → Onboarding email sent / tool setup if needed → Mark Active. Other types' steps still my draft
- **2026-10-27:** Prototype v4: regions are APAC / US + RoW / All (US and RoW combined; both Hemmi)
- **2026-10-27:** Prototype v5: automation log only in its own 'Automation log' tab (removed from Today queue/side panel and profiles); nav shows failed-run count in red
- **2026-10-27:** Prototype v6: 3 tabs only. Open items (requests with per-type tabs + action-plan cards, ending soon, data to fix, next 30 days, by region); Roster (was Contractors; profile shows past requests); Automations (card per automation: status, schedule, last run, setting, Run now / Dry run / Pause / View log; log below). Requests tab removed
- **2026-10-27:** Prototype v7: Open items split into 4 separate type pages (no combined 'All'): each has its own how-it-works, cards, and date column (start dates / current end dates / last days / effective dates). 'Ending soon, nothing filed' only on Extension + Offboarding. Data to fix moved to Roster. Lesson: never merge the 4 request types into one list
- **2026-10-27:** Prototype v8 (agreed layout): Nav = Open items | Roster | Automations. Open items = 4 separate request tabs, each grouped by its own stages (stage = last finished step; Action Required on top; 'Ready: <final action>' last), flow strip shows count per stage. Roster = grouped by SoT status + 'Open request' filter per type. Extension/Offboarding/Rate Change steps still my draft
- **2026-10-27:** Prototype v9: Roster = contract timeline (row per contract: SoT status chip + region, bar start→end colored by SoT status, today line, dashed teal bar = pending extension, magenta mark = offboarding date, time left + open request tags). Status count chips filter; sort by end/start/name; show ended toggle; open-request filter kept; Data to fix on top. Onboarding status chip now yellow like the Sheet
- **2026-10-27:** Prototype v10: visual refresh per Shihyun ('less like Claude'): Geist + Geist Mono, true neutral greys, black primary buttons, cobalt accent (no purple), 10px corners, borders not shadows. Type colors unchanged
- **2026-10-27:** Prototype approved (v10). Build plan (phases 0-5) written into 13b progress.md 'Planned: redesign'
- **2026-10-27:** Redesign Phase 0 done (decisions + 4 action plans). Phase 1 groundwork built locally (plans, Steps tab storage, regions, /v2 shell); not deployed. Next: Phase 2 Open items
- **2026-10-27:** Redesign Phase 2 (Open items) built + tested locally at /v2; waiting on Shihyun to deploy
- **2026-10-27:** /v2 Open items deployed (dpl_DEs3uGz2cwqTATdt1z9YfhfCHT62). Next: Shihyun tries it; then Phase 3 Roster
- **2026-10-27:** Region order All / APAC / US + RoW deployed. Progress saved; next session starts from 'Start here'
- **2026-10-27:** /v2 polish deployed: region order, removed tags for automations that don't exist yet, IT access-removal Copy message (name, email, last day), overlap fix. Drafted teammate feedback message (00-inbox/hojicha-v2-feedback-slack.md)
- **2026-10-28:** First SoT cron run verified (4 flips, logged). Onboarding plan now 6 steps; profile shows all Form Responses answers; DocuSign signed → auto-tick hook live on the dashboard (bot deploy pending)
- **2026-10-28:** Saved progress. Hojicha v2 polish live (step names, Automatic tags, IT setup message, profile toggles, default view). Started retention tracker v0 prototype
- **2026-10-28:** Retention tracker v0 prototype published (https://claude.ai/artifact/E5hYa1ftdxo2LVUiycqW75): weighted measures, red / amber / green, action plans with draft triggers, Notion plan button, role-based views
- **2026-10-28:** Retention prototype v2: weights are on/off toggles + sliders (relative importance; shares always total 100%), donut chart of the weight split with legend, live red / amber / green counts and 'N affected' per measure while dragging; thresholds tucked under 'When it counts'
- **2026-10-28:** Retention prototype v3: tracker is People Ops only (View as removed). Managers get a private Notion page per action plan (shared with manager + People Ops + HRBP): neutral 'why we're investing here', actions, talking points, notes; no score unless People Ops ticks 'include score breakdown (internal page only)'. Proposal access section updated
- **2026-10-28:** Verified HiBob data for retention measures: pay stagnation, time in title, manager change available; pulse only partially (no pulse since Q4'25); no Great / pivotal field; no org level history
- **2026-10-28:** Removed middle dots from the retention prototype (published) and Hojicha v2 (built, deploy pending)
- **2026-10-28:** Retention prototype in Speak colors (from speak.com CSS): Speak blue #1C49FF, navy #12205A, periwinkle #DDE4FF, grey #F2F4F6, purple #8B61FD + sky #0094FF for pulse / manager measures; fonts Outfit + Plus Jakarta Sans (Axiforma / Pretendard can't load in artifacts). Hojicha v2 unchanged (her call)
- **2026-10-28:** Retention prototype restyled to the Speak *app* look (from App Store screenshots): navy band #012147 with pill tabs, light grey canvas #F2F2F4, rounded floating white cards, pill buttons / chips in Speak blue #0047FF, app accents orange / teal / purple for measures; font Outfit. Red / amber / green unchanged
- **2026-10-28:** Retention prototype font: Geist + Geist Mono (Outfit was too round for Shihyun); matches Hojicha v2
- **2026-10-28:** Retention prototype font: Inter Tight (closest to Speak's Pretendard) + Geist Mono for numbers
- **2026-10-28:** Retention prototype: font sizes unified to a 6-step scale (12 / 13 / 14 / 16 / 20 / 28px as tokens --t-xs..--t-2xl)
- **2026-10-28:** Retention prototype Proposal page rebuilt as a one-page pitch: headline + ask, 5-step how it works, is / isn't, data we'd use (real HiBob check), who sees what grid, rollout v0 / v1 / v2 / ongoing with needs, asks checklist, open questions (org level history answered)
- **2026-10-28:** Retention prototype list: drawn country flags (KR / JP / TW / US / FR / BR, SVG not emoji) before names; region + manager moved under the name; Next action moved to the far right as a clickable card (blue on track, red overdue, outlined 'Create plan' if none) that opens the panel scrolled to the action plan
- **2026-10-28:** Retention prototype: Notion preview popup is now a solid panel with a strong shadow on a dark backdrop; buttons in a grey footer bar, Back is a white outlined button
- **2026-10-28:** Retention prototype lightened: white header (navy text) with soft blue banner strip, light grey tabs with soft-blue selected tab, airier background #F7F8FB, softer popup backdrop
- **2026-10-28:** Retention prototype: Watch color is now true yellow (#F2B705 dot / stripe / number, #9A7300 text for contrast)
- **2026-10-28:** Retention prototype Review rebuilt as a proactiveness / effectiveness report: KPI tiles (plan coverage, time to plan, no plan yet, on time, overdue), quarterly trend (coverage + on-time lines, regretted exits per quarter), 'Is it working?' (stayed with vs without a plan, score change after action, regretted exits flagged beforehand), plan mix by action type colored by trigger, follow-through by owner + dismissed reasons, digest preview. Current quarter live; history / outcomes sample
- **2026-10-28:** Retention prototype Review softened (Shihyun: too number-heavy / harsh): friendly 'this quarter so far' sentence + progress ring + 'Start a plan for X' chips; 3 plain-language cards; 'Is it working?' as person dots (no red); 'Conversations we've had' soft bars; plans over time as soft area line; 'Who might need a nudge' list with Draft a nudge (copies a friendly Slack note); digest collapsed
- **2026-10-28:** Retention prototype toned down ('no need to be too grand'): Review summary is a plain card with normal-size sentence, small ring, name chips, and one card of three short facts; Proposal rewritten plainly (short intro, numbered how-it-works, data table, who-sees-what, plan table, needs + open questions as simple lists)
- **2026-10-28:** Retention prototype Proposal made brief, centered on function and usage: what it is (1 line), what it does (4 bullets), how we'd use it (weekly / monthly / quarterly), who uses it, one line on what's needed to start. Data check / access grid / open questions moved off the page (kept in this progress file)
- **2026-10-28:** Retention prototype: '+ Add people' on the Attention list. One person form (name, title, team, manager, country, region, start date, title since, last pay change, manager since, team pulse change, reviews) scores instantly; Import CSV (paste or file, columns name,title,team,country,region,manager,level,hired,title_since,last_pay_change,manager_since,pulse_change,reviews; skips rows without name / pay date). Browser-only, test data only. In v1 these come from HiBob; People Ops only marks Great / pivotal
- **2026-10-28:** Proposal gained a short 'How to use it' (5 steps: get people in [HiBob in v1 / + Add people in prototype], check the list, open a person and plan, share manager Notion page, follow up in Review)
- **2026-10-28:** Proposal sections now have small graphics (line icons, not emoji): 'What it does' as 4 tiles with mini illustrations, 'How to use it' as a 5-step connected flow, 'How we'd use it' as weekly / monthly / quarterly calendar tiles, 'Who uses it' as role badges + lock note
- **2026-10-28:** Removed unnecessary line breaks: dropped narrow text caps (proposal intro / closing line, step text 22ch, page 1040px, review headline 48ch); button names in steps stay on one line; plan-mix labels fit on one line
- **2026-10-28:** Notion page updated (with Shihyun's go-ahead): contractor lifecycle rows refreshed (DocuSign auto-tick, SoT sync verified, Hojicha v2 row) + toggle 'Hojicha v2: current version (Oct 28)'; retention tracker concept callout, Proposal row (prototype link), weighting bullet (weights + cutoffs), access bullet (People Ops only + manager Notion pages), v2 bullet, org-level question ticked; new toggles 'HiBob data check (Oct 28)' and 'Prototype v0: what's in it'
- **2026-10-28:** Speak performance scale (from Shihyun): Great Performance / Good Performance / Needs Improvement. Prototype sample reviews switched from 'Strong' to 'Good'; form + CSV hints list the scale. Idea: Great / pivotal list could default to 'Great Performance' in the last cycle (HiBob performance cycles) + pivotal added by hand
- **2026-10-28:** Retention prototype: 'Search HiBob' is now the first tab in + Add people (sample directory of fake people; v1 searches HiBob). Pick a person → read-only 'From HiBob' facts (manager, region, start, title since, last pay change, manager since, team pulse, ratings) → 'You add': why on the list (Great Performance / Pivotal role / Both) + optional check-in (date, type, feeling Good / Mixed / Concerned, themes, short note). Check-ins show in the panel + timeline, context only (not scored; decision pending). Picking someone already listed updates them
- **2026-10-28:** Overall review shared with Shihyun: risks (perception / naming, PIPA + APPI privacy review before v1, weights unvalidated (do a look-back), pay/title signal bias, capacity: APAC pilot 20 to 30 people). Name ideas: Tend (favorite), Stay & Grow, Anchor, Keepers, Bloom, Steady; softer labels Needs attention / Check in soon / Doing well. Proposed more actions per driver + tools: 'Did it help?' 30-day follow-up, Moments that matter calendar, manager prep brief, stay interview kit, team patterns for HRBP, comp review packet. Waiting on her pick
- **2026-10-28:** Notion: added toggle 'Review and ideas (Oct 28)' under the retention tracker (overall take, watch-outs, name ideas + softer labels, more action plans table, more tools, suggested next, Great Performance list idea)
- **2026-11-17:** Built the AI Acceleration (WIP) team page in Notion (overview of contractor + Bloop automation, Q4/Q1 bullets, offboarding plans, roadmap toggles with status tables, Not started yet toggle, Roadmap tracker DB grouped by Project). Bloop page nested inside it
- **2026-11-18:** Contractor lifecycle / DocuSign (13c): switched to form submit -> prefilled DocuSign DRAFT (never sends). Sandbox prototype works for Pay As You Go + Fixed Rate. Blocked on Hemmi: form dropdowns (payment type, rate amount + currency), template wording, DocuSign admin for prod. Offer-letter reuse idea noted. Notion updated: AI Acceleration contractor table row 'Send contract' -> 'Prototype | Contract drafts', tracker row renamed 'Contract drafts (DocuSign)' (In progress) + new Idea row 'Offer letter drafts (DocuSign)'; SH Q4-Q1 'Google Sheet → DocuSign' row -> Prototype with new notes.

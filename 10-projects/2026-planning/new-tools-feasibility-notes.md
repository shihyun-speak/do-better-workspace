# New Tools: Feasibility Notes (for later)

> Parked 2026-10-23. Removed from the Notion Q4-Q1 page because that page is for aims; feasibility gets explored later.

💎 Top Performer Retention Tracker
  callout e1e9cd6d4377: Status: Exploring | Design for global, pilot in APAC | Owner: Shihyun (build), sponsor TBD
  heading_4 c7ddb0b415c6: 1. Problem
  bulleted_list_item cdc46dfa533e: Follow-through on Great / pivotal talent investment is inconsistent; it depends on each manager remembering
  bulleted_list_item e3f598602750: Early signals (stagnation in level, pay gap, manager change) are spread across HiBob, spreadsheets, and managers' heads
  bulleted_list_item ef21316cb6f4: We often learn about risk at resignation, so retention conversations are reactive
  heading_4 d9ed1159b76e: 2. Goal & Success Measures
  paragraph f87140b68ed1: Goal: every Great / pivotal person has regular career conversations and a visible investment action; leadership sees who needs attention, monthly.
  table d4adf8ce6629: 
    table_row e69d6a4d71c7: Measure || Target || Type
    table_row c84f8bbb9860: Great / pivotal with a career conversation in the last 90 days || 100% || Leading
    table_row d12433d3e15e: Time from flag to action || < 30 days || Leading
    table_row e788a953ab3d: Each Great / pivotal person has 1+ investment action per half || 100% || Leading
    table_row c4790f094e1b: Regretted attrition among Great / pivotal || Track vs last year || Lagging
    table_row cb2b0ac76217: Managers find it useful (quick pulse) || Mostly yes || Qualitative
  heading_4 f11c3ccb9bf6: 3. Scope
  bulleted_list_item d5e2211dbe58: In: Great / pivotal list (defined by leadership); rule-based flags; action plans + manager tools; global design, APAC pilot
  bulleted_list_item d403c9d676fe: Out: predictive scoring / ML; individual survey responses; automated decisions on comp or promotion
  heading_4 d16e31f3b978: 4. Signals
  table c858a0583ccf: 
    table_row f1dae2408b4f: Signal || Source || Example rule || Sensitivity
    table_row fab61af3b2f4: Time in level || HiBob || 18+ months || Low
    table_row d7b0dbdbd644: Time since last pay change || HiBob || 12+ months || Medium
    table_row c4b9b528172e: Comp vs band || Level / Comp bands || Below band (flag only, no numbers) || High
    table_row f8a6bc5a1beb: Manager change || HiBob || Within last 6 months || Low
    table_row d97c0033ff48: Tenure milestone (anniversary, vesting) || HiBob / equity system || Within next 3 months || Medium
    table_row ff1f9b374736: Last career conversation || HiBob 1:1 Meetings / manager log || 90+ days ago || Low
    table_row dbfdbcf7082f: Team engagement trend || HiBob Surveys (team level only) || Drop vs last pulse || Low
    table_row c33efffe409d: Qualitative themes || Stay interview / 1:1 notes || Manager-raised concern || High (consent)
  paragraph c93c610762ca: Look-back: pull past regretted exits (anonymized) and check which signals were present ~6 months before. Use the result to pick and tune the rules. Tools: HiBob leavers export + AI analysis.
  heading_4 fd16b7440653: 5. Approach Options
  table c0f6cb310069: 
    table_row d3f2713c450c: Option || How || Pros || Cons
    table_row d68dfa10a5d6: A. Manual tracker || Restricted Google Sheet + monthly review with leadership || Fastest, no access requests || Manual upkeep
    table_row c50220527b7f: B. HiBob-native || Custom report / dashboard + 1:1 Meetings + Development Plans || Data stays in SoT; permissions built in || Limited rule logic
    table_row d5283989bb60: C. Light automation || HiBob API → restricted dashboard with flags + Slack nudges to managers || Scales globally, low upkeep || Needs API access + security review
  paragraph cfaeef1c0a98: Leaning: A or B for the pilot; move to C if it proves useful.
  heading_4 e88b4b0f6822: 6. Action Plans & Manager Tools
  bulleted_list_item e2bde1408916: Motivator menu: growth (stretch project, scope expansion, promotion path), recognition (visibility, awards), comp (off-cycle review), flexibility, relationship (skip-level, mentor)
  bulleted_list_item d82282dec31f: Manager tools: stay-interview guide, career conversation template, HiBob Development Plans
  bulleted_list_item da9e843500c3: Nudges: Slack reminder to managers framed as "time for a career chat with X", never "flight risk"
  heading_4 c41c324d774e: 7. Feasible / Desirable / Viable
  bulleted_list_item f957ca7f1363: Feasible: Medium. Most signals already exist in HiBob; comp vs band depends on Level / Comp work; global sample makes the look-back possible
  bulleted_list_item de3f50ed1843: Desirable: High. Directly supports the Q4 talent focus (invest in top talent, targeted retention conversations)
  bulleted_list_item d00dfb94cc1a: Viable: Medium. Depends on a sponsor, data access, and privacy sign-off
  heading_4 ed1dd695ae41: 8. Stakeholders
  table d8d082f428c4: 
    table_row cbbb650e906a: Role || Who
    table_row f47324e38b57: Sponsor || Global POps lead / leadership (TBD)
    table_row ff19ba173117: Owns the Great / pivotal list + decisions || Leadership + managers
    table_row cb6e2803f9df: Data + comp bands || HRBP / Generalist
    table_row d298d9578a40: Build + run || Shihyun
    table_row c324a073b9d1: Privacy review || Legal (KR PIPA, JP APPI, US state laws)
  heading_4 e34964650099: 9. Risks
  bulleted_list_item c89580fc8dae: Trust / privacy: keep surveys team-level, restrict access, be clear about purpose
  bulleted_list_item f97ef1a52192: Labeling: flags read as "flight risk"; frame as investment check-ins
  bulleted_list_item d83d3f8f0269: Small sample: rules may flag the wrong people; review with managers before acting
  bulleted_list_item db1c5c18ebfa: Data quality: depends on the HiBob data audit
  bulleted_list_item c9429d447bc1: Manager fatigue: keep nudges rare and specific
  heading_4 c6ff2c24048e: 10. Milestones
  to_do c4c8def3ee0a: [ ] Explore (Nov to Dec): find sponsor, privacy check, look-back on past exits, agree signal rules
  to_do d8fc26433597: [ ] Pilot (Q1): APAC Great list, monthly review, manager toolkit
  to_do e50ffb17f5b9: [ ] Scale (Q2+): global rollout, automation (option C)
  heading_4 ddca8e4076b2: 11. Open Questions
  to_do c1c7a9099a81: [ ] Who owns the Great / pivotal list, and how often is it updated?
  to_do e7bf0114749e: [ ] Can I access level and pay change fields, or does the HRBP / Generalist own that part?
  to_do e88c228d8f58: [ ] Is there a comp band / benchmark source today?
  to_do c34a5581adcf: [ ] How do managers log career conversations now?
🧭 Team-Level Onboarding (CSM Pilot)
  callout e84e62bd6f22: Status: Exploring | Pilot: CSM team | Design for global | Owner: Shihyun (build), CSM lead (content)
  heading_4 fa28d70b0a18: 1. Problem
  bulleted_list_item f90ead387cc9: POps onboarding mostly ends around Day 1 (accounts, welcome, tools)
  bulleted_list_item fadc0bd53c6c: Role-specific ramp lives in scattered Google Docs, meeting notes, and teammates' heads
  bulleted_list_item eef5d77d3432: Each new hire's ramp depends on who is around; managers re-explain the same context
  heading_4 ff835030d8ca: 2. Goal & Success Measures
  paragraph cdc8e4189221: Goal: a new hire joining a team has one place for team context and a tailored 30/60/90 from Day 1.
  table cf49d84716f2: 
    table_row cd802ac928e3: Measure || Target || Type
    table_row f0a9be87698f: Time to first independent milestone (e.g. CSM owning accounts) || Faster than past hires || Outcome
    table_row cc3a95c7f6a6: New hire survey at D+30: "I have what I need to do my job" || Up vs past hires || Experience
    table_row f2ce3467d5cf: Manager time spent on onboarding || Down || Efficiency
    table_row e2f28eb11ab7: Repeated questions to team members || Down || Efficiency
  heading_4 c5547a5f8211: 3. Scope
  bulleted_list_item df2b45be049e: In: one team pilot (CSM); role hub; 30/60/90 by level; check-ins
  bulleted_list_item c29e95d6a041: Out: building product training content; replacing team training programs; buying an LMS
  heading_4 dbc502c99efe: 4. Components
  numbered_list_item e2718bc0cc51: Role hub (Notion): team overview, key people + who to ask, tools and access, recurring meetings (what / why / when), key docs, glossary, FAQ
  numbered_list_item e511b8b3f091: Tailored 30/60/90: template with level variants (junior / senior / lead); AI drafts from JD + level + hub; manager edits
  numbered_list_item d2d76f4ef5b3: Q&A tool (phase 2): AI assistant loaded with the hub docs so new hires can ask questions; Slack bot later
  numbered_list_item e5a223709ccc: Check-ins: D+20 / D+50 1:1s, new hire survey, 30/60/90 reminders (reuses key result automations)
  numbered_list_item d7a21a566c05: Maintenance: team owner, quarterly review, "last updated" date on the hub
  heading_4 f7669985a7ac: 5. Approach Options (building the content)
  table cbeefda92d3f: 
    table_row c131bc1ba2cb: Option || How || Pros || Cons
    table_row c79426d76326: A. Interview-led || 30-min chats with Jiwon, Sumin, Michelle; AI turns notes into the hub || Captures unwritten context || Takes their time in peak season
    table_row eb7604f0227d: B. Doc-led || Pull their Drive folders + recurring calendar events; AI synthesizes; leads review || Low effort for the team || Misses what isn't written down
    table_row c4592ac2ab0c: C. Mix || B first, then one 30-min review session || Best coverage, light on the team || Slightly longer
  paragraph c7e795d01ed9: Leaning: C.
  heading_4 d26980ad00aa: 6. Tools
  table fcc3837da740: 
    table_row cfbb92a46f2a: Need || Tool || Note
    table_row e8adc420f990: Gather docs + meetings || Google Drive + Calendar (gws), AI summary || Respect existing sharing permissions
    table_row d3237c868a60: Role hub || Notion template per team || Simplest; easy to copy to other teams
    table_row cccc6a8e6062: 30/60/90 || Notion template + AI draft || Manager always edits
    table_row fe726237b9b3: Q&A || Claude Project / Gemini / NotebookLM (whichever is approved) || Phase 2
    table_row e5b69ea4ed58: Check-ins + feedback || Slack bot / HiBob tasks + HiBob new hire survey || Shared with key result automations
  heading_4 c1fe10f91598: 7. Feasible / Desirable / Viable
  bulleted_list_item fbc70ad466b4: Feasible: High. Content exists; tools are already in use; AI cuts the gathering work
  bulleted_list_item f365b1572527: Desirable: High. Supports "ramp new hires quickly"; managers and new hires both benefit
  bulleted_list_item c37231cdecb2: Viable: High. Low cost; one template scales across teams and markets
  heading_4 f1a0ae61e2b0: 8. Stakeholders
  table f1c4b24e1a28: 
    table_row d80e5b7d5ee1: Role || Who
    table_row ff1ad6bee387: Sponsor + content owner || CSM lead
    table_row f8015556088a: Sources || Jiwon, Sumin, Michelle
    table_row df5893a21756: Pilot users || Next CSM hire + hiring manager
    table_row fb11a1592e42: Build || Shihyun
    table_row e86cf444ac42: Scaling to other teams || Shihyun + Generalist
  heading_4 ce8b500a3616: 9. Risks
  bulleted_list_item f7eb25f4ae01: Content goes stale: team owner + quarterly review
  bulleted_list_item f9977a0bcb8f: Team bandwidth in peak season: doc-led first, short review only
  bulleted_list_item d3ec079acb93: Sensitive info in docs: keep permissions; no customer data in AI tools without approval
  bulleted_list_item f2e511486e76: No hire to pilot on: test with a recent hire for feedback instead
  heading_4 f3c3e0716497: 10. Milestones
  to_do f95d9f683820: [ ] Explore (Nov): CSM lead buy-in, next hire date, gather docs
  to_do d1cb1401f3a8: [ ] Build (Dec): hub + 30/60/90 draft, review with the team
  to_do fb63f2d8335d: [ ] Pilot (Q1): next CSM hire, feedback at D+30
  to_do c75d8d1a9f94: [ ] Scale (Q2+): template, second team, global
  heading_4 ffc8a5b04869: 11. Open Questions
  to_do e0c945d31f58: [ ] When is the next CSM hire?
  to_do e16db0d94e15: [ ] Is the CSM team global or APAC?
  to_do df3f2b477091: [ ] Who owns the content after launch?
  to_do f116fc001dd2: [ ] Which AI tool is approved for internal docs?

## Partial automations: tool / effort notes (parked from the Automations table)

| Workflow || Step || Automation idea || How (tool) || Effort || Quarter || Realistic? || Decision / notes |
|---|---|---|---|---|---|---|---|
| Onboarding || Owner handoffs after formal offer || Notion checklist created |
| Onboarding || Probation alert || Slack DM to People Ops / direct manager before probation end date || HiBob reminder, or daily script on HiBob dates || Low || Q1 ||  ||  |
| Onboarding || New hire survey reminders || Auto reminder at set days after start || HiBob surveys / Slack bot || Low || Q1 ||  ||  |
| Onboarding || 1:1s at D+20, D+50 || Calendar invites created from start date || Google Calendar API script || Med || Q1 ||  ||  |
| Offboarding || Access removal after notice || Scheduled task + reminder to IT for last day || Slack bot + Calendar, or HiBob Flows || Med || Q1 ||  ||  |
| Contractor || Google Sheet → DocuSign || Send contract button on the dashboard || DocuSign API in contractor dashboard || Med-High || Q4 ||  ||  |
| Contractor || Onboarding / extension / offboarding emails || Email drafts generated from the Sheet row || Apps Script / Gmail templates || Low || Q1 ||  ||  |
| Offboarding || Offboarding checklist audit || Check each exit's checklist for missed steps, post a summary || Script on checklist (Notion / Sheet) + Slack summary || Low-Med || Q4 ||  ||  |

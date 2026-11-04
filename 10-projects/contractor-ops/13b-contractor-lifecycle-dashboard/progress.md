# Global Contractor Dashboard — Progress Log

> What's been built, where it lives, and what's next. See [`README.md`](README.md) for the user-facing intro and run instructions.

## Live deployment

- **URL**: https://speak-ctr-hojicha.vercel.app
- **Hosting**: Vercel (project `speak-ctr-hojicha`, scope `shihyunl-7107s-projects`)
- **Access**: Google OAuth via NextAuth, hardcoded 4-email allowlist (`shihyun.l@`, `sunjae@`, `hemmi@`, `mina@` — all `@usespeak.com`)
- **Data source**: same Google Sheet as the Slack reminder bot (`1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM`)
- **Service account**: `ctr-bot@shihyun-gws.iam.gserviceaccount.com` (Editor on the sheet)
- **OAuth client**: `765225737444-...apps.googleusercontent.com` in GCP project `shihyun-gws` (Internal user type, so only `@usespeak.com` accounts can attempt sign-in)
- **Last deploy**: 2026-11-04 (`dpl_2bA5pwjfmWYhLW2B9QQsZH7fcoBW`, redesign is now /, old view at /classic; before that `dpl_6yjGQSYuMgE2mNvtxAoRd7vhZzDr`, login page restyle; before that `dpl_3EEQEzjcwNKP97Z3FP6roBuc6zCg`, sign-in info + Sign out + owner line in /v2 sidebar; before that `dpl_6wR5GzWkg6RR6QxySWG8EbTaX4xG`, What's new tab; before that `dpl_6jgbmwtArNNU8UBiFqUv86vmzNEe`, D-day pills + 'Requested N days ago'; before that `dpl_49Uknh1oQ7GDTi8xjCmaTDKrwXGp`, shared date calendar + Scope toggle, via scripts/deploy.sh; before that `dpl_8V2oR6fcSLQLt6nFMEcVHTkTMH88`, status follows checklist + Needs info removed; before that `dpl_7EvyRyBYtGmeKNeBzQnZugBkNwvP`, Hemmi card changes: Scope + Country of residence; before that `dpl_2r7DygzFTVz5YxxM5NSxBuJXte9K`, Roster status tabs + manual status dropdowns; before that `dpl_2Y3T33xcKsN6CBFCaogpvC3GQ7Q6`, Roster tab v1; before that `dpl_3UDvJkdWWN8y9oYSUFXAqXKCEmtd`, IT drafts trimmed to name / date / systems, setup adds new Speak email placeholder; before that `dpl_679zdkxwr4DaeorbD4weSWpH7PsL`, middle-dot cleanup; before that `dpl_DJKfWiZ1ktQVbjAzyQL2kTU395EP`, Automatic tags + IT setup message; before that `dpl_Aw6NW5P5CFrdytWDduLT7MqMFag7`, refined step names + profile toggles; before that `dpl_DisNg2Xhwx1xqGytCJMa77mdTevM`, default view All → Open items → Onboarding; before that `dpl_96p2qC7JvZsZNgtawn1Er4Aficq2`, onboarding 6 steps + full-answer profile + DocuSign hook; before that `dpl_EAkUskk5JxWx8Qphe6cEHvgkGv21`, profile panel; before that `dpl_EUv63DqYanxq1NEs3aan8ipyomoG`, copy-button overlap fix; before that `dpl_8gaFYPGzxTRoqpr2XJcJtdCVNYMB`, tags cleanup + IT copy message; before that `dpl_EaApAoYzUYtyuSVEABZdqbnmCJpb`, region order; before that `dpl_DEs3uGz2cwqTATdt1z9YfhfCHT62`, /v2 Open items; before that `dpl_ATvYtG88cMcC39swaVxCKW9VLgDz`, Activity tab; before that `dpl_Aaw1P2mSBGL3aWcd4UCmtDJFWSpj`). Previous: `dpl_GD6E6Ep43S4W3LsJjkTyRfBn3VP9` (5/12)

## What's working today

### Read path
- 5 tabs read live from the sheet via Google Sheets API: `[SoT] Contractor Tracker`, `Onboarding` (cols A:R), `Extension` (A:F), `Offboarding` (A:H), `Rate Change` (A:I).
- Cached server-side for 60s; manual ↻ Refresh button busts the cache instantly.
- Country comes from `Form Responses` cross-referenced by canonical name.
- Owner routing (Shihyun = APAC, Hemmi = US + RoW) mirrors the Slack bot.
- **`Form Responses` tab is read for country lookup only — never written.**

### Columns surfaced per tab
- SoT (Active Roster + Inactive): Name (with Job Title · Department subtitle), Owner, Country, Manager, Approver, Status, Contract end. Start column only on Inactive. Active Roster shows pending end-date changes as `current → proposed` arrow (indigo extension / red early offboarding).
- Onboarding: + Scope, Payment Rate, Working Location, SaaS Tools
- Extension: + Scope, Payment Rate (from matching Onboarding row), Scope/Rate Changed?
- Offboarding: + Reason for Termination, Notified?
- Rate Change: + New Payment Rate
- Toggleable column visibility per tab; preference persists in localStorage.

### UI
- Sortable tables, not cards (cards didn't scale past ~10 rows).
- Tab strip: Active Roster / Onboarding / Extension / Offboarding / Rate Change / Inactive.
- Filters: owner (APAC / RoW / Unknown / All) + free-text search (covers all extra fields too).
- Status pills match the Sheet's own dropdown chip palette (green Active / yellow Onboarding / peach Ending Soon / red Action Required / dark Ended / gray Voided).
- Owner pills split three ways: `APAC` (green) / `US` (amber) / `RoW` (blue) / `?` (grey) — US gets its own pill instead of being lumped under RoW.
- Active Roster pins **Onboarding** + **Ending Soon** rows above plain Active rows regardless of column sort.
- Inactive tab catches: Status = Ended/Voided, end date in the past (badged "Expired"), or rows with `#N/A`/`#REF!` data errors (badged "Data error").
- Dates: MM/DD/YYYY on request tabs; Active Roster uses compact MM/DD (drops year when current).
- Urgency badges compact: `5d left` / `2d ago`, color-coded.
- TruncatedCell popover: long values (Scope, Reason, SaaS Tools, Job Title + Department, Country) get `…` with click-to-expand; uses `position: fixed` to escape the table's overflow-x-auto.
- Country normalization: `California, US` / `California` / `CA` → `US · California`; 2-letter country codes (`KR` → `South Korea` etc.); strips trailing US-suffix variants.
- Payment Rate formatting: bare numbers get `$` prefix; appends `/hr` / `/mo` / `(project)` from Type of Contract Payment.
- Infinite scroll: 20 rows per page, IntersectionObserver-based; resets on tab/filter/sort change.

### Write path
- Status dropdown on every row writes back to the sheet:
  - Request tabs → column A (Status)
  - Active Roster (SoT) → column H (Status)
- Per-tab status allowlists prevent garbage writes.
- Name-vs-row safety probe before each write returns 409 if the sheet was reordered since the page loaded.
- Optimistic UI update with auto-revert + alert on failure.
- "Ending Soon" is normalized to lowercase "Ending soon" on write so the Sheet's own chip color renders.

### Auto-sync side-effects (SoT writes triggered by request-tab status changes)
- **Offboarding status → SoT Status (col H)**:
  - Pending / Action Required / blank → `Ending soon`
  - Completed → `Ended`
  - Void → no-op
- **Onboarding → Active → SoT Status (col H) = `Active`**
- **Extension → Active → SoT Status (col H) = `Active`** (plus the col G End Date write below)
- **Rate Change → any status → no SoT write** (orthogonal to lifecycle)
- **Extension → Active → SoT End Date (col G)**: writes the **latest Active Extension's** `New End Date` to SoT col G (not just the row clicked). Handles contractors with multiple Active Extension rows by taking the most-recent end date. Overwrites the MAXIFS formula — matches the existing manual override pattern.
- **Offboarding earlier than SoT → SoT End Date (col G)**: if Offboarding row's End Date is earlier than current SoT End Date, writes the earlier date to col G (regardless of offboarding status, except Void).
- **Audit log**: every SoT End Date auto-sync posts a Slack DM via `SLACK_AUTH_ALERT_WEBHOOK` with `from → to` and trigger reason.
- **Form Responses is never written to** — `Form Responses` is the source of truth that the SoT col F/G/A formulas read from; we only override col G when the formula's auto-derived end date is wrong.

### Auth
- **NextAuth v5** (Auth.js) with Google as the only provider — replaces the earlier custom password gate.
- **Two-layer access control**:
  1. GCP OAuth consent screen is set to "Internal" → Google itself only lets `@usespeak.com` Workspace accounts attempt sign-in.
  2. App-level allowlist in `auth.ts` denies anyone outside the 4 names above.
- **Session**: JWT signed with `AUTH_SECRET` (256-bit random). 30-day expiry. `HttpOnly` + `Secure` + `SameSite=lax`.
- **Login page** at `/login` shows a Google sign-in button + a "Request it" link that opens an inline access-request form (Name / Work email / Reason). The form posts to a server action that sends the request to `SLACK_AUTH_ALERT_WEBHOOK`. Renders an explicit "Account not on the access list" panel when NextAuth returns `error=AccessDenied`. Header subtitle is contextual: sign-in / "You've been signed out." / "Request access to the dashboard."
- **Sign-out button** in the dashboard header next to ↻ Refresh; posts to `/signout` (custom route — not NextAuth's built-in, which was failing with `MissingCSRF` on prod). The route emits 12 `Set-Cookie` headers expiring every known NextAuth cookie (unprefixed + `__Secure-`/`__Host-` variants) with matching `Path=/`, `SameSite=lax`, and `Secure` flags so browsers actually honor the deletion. Lands on `/login?signedout=1` showing "You've been signed out."
- **Slack alert on denied sign-in**: NextAuth's `signIn` callback fires a fire-and-forget POST to `SLACK_AUTH_ALERT_WEBHOOK` with the denied email + display name + timestamp, so Shihyun gets a DM whenever someone outside the allowlist tries to get in.
- **Middleware**: every non-public path requires a valid session. API calls without one get a 401 JSON; page navigations redirect to `/login` with `?next=...` so post-login they land where they were headed.

## Architecture

```
                Google OAuth (accounts.google.com)
                        │
                        ▼
              /api/auth/[...nextauth]  ──▶ JWT session cookie
                        │
                        ▼
                  middleware.ts  ──▶  401 / redirect to /login if no session

Google Sheet ──(Sheets API, read+write)──▶ lib/parsers.ts
                                              │
                                              ▼
                                   /api/contractors (JSON, 60s revalidate)
                                              │
                                              ▼
                                   app/page.tsx (SSR, reads session via auth())
                                              │
                                              ▼
                                   components/Dashboard.tsx (client)
                                              │
                                              ▼
                                   PATCH /api/contractors/status (write)
                                   POST  /api/contractors/refresh (cache bust)
                                   POST  /api/auth/signout
```

| File | Purpose |
|---|---|
| `auth.ts` | NextAuth config: Google provider, email allowlist, denied-signin Slack alert |
| `lib/auth.ts` | Service-account JWT → Sheets API access token, in-memory cached |
| `lib/sheets.ts` | `readRange` (60s revalidate) + `writeCell` |
| `lib/parsers.ts` | One loader per tab, lifecycle classification, Onboarding/Ending Soon detection |
| `lib/owners.ts` | APAC/RoW routing + name aliases |
| `lib/dates.ts` | Date parsing + working-day math |
| `middleware.ts` | Session check on every request; bypasses `/login` and `/api/auth/*` |
| `app/page.tsx` | SSR entry, reads session, hydrates `<Dashboard />` |
| `components/Dashboard.tsx` | Tabs, filters, tables, status dropdowns, refresh + sign-out buttons |
| `app/login/page.tsx` | Sign-in-with-Google button, Request Access mailto link, AccessDenied panel |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth's catch-all (sign in / sign out / callback / providers) |
| `app/api/contractors/route.ts` | Read-only JSON endpoint |
| `app/api/contractors/status/route.ts` | PATCH endpoint for status writes |
| `app/api/contractors/refresh/route.ts` | POST endpoint that calls `revalidatePath` |

## Env vars (Vercel + .env.local)

- `GOOGLE_SA_KEY_JSON` — single-line service account JSON for Sheets API
- `GOOGLE_CLIENT_ID` — OAuth client ID for the NextAuth Google provider
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `AUTH_SECRET` — 64-char hex used by NextAuth to sign session JWTs
- `AUTH_URL` — canonical URL (`https://speak-ctr-hojicha.vercel.app`); pins the host NextAuth uses so cookies don't drift across aliases
- `AUTH_TRUST_HOST` — `true`; needed because the project runs behind multiple Vercel-assigned hostnames
- `SLACK_AUTH_ALERT_WEBHOOK` — Slack incoming webhook URL; receives DM alerts when a sign-in is denied AND when someone submits the access-request form
- `SPREADSHEET_ID` (optional) — overrides the default sheet ID

> Old vars `DASHBOARD_PASSWORD` and `DASHBOARD_AUTH_SECRET` were removed when the password gate was replaced with Google OAuth.

## Build history

| Date | What changed |
|---|---|
| 2026-05-06 | Initial scaffold: Next.js 16 + Tailwind. Five tabs, owner filter, search. Card layout. Read-only. |
| 2026-05-06 | Status write-back on the four request tabs (PATCH route, dropdown, optimistic update, name-guard). |
| 2026-05-06 | Lowered cache 5min → 60s. Added `/api/contractors/refresh` + ↻ button. |
| 2026-05-06 | Switched cards → sortable tables. Pending/Action Required rows visually flagged. |
| 2026-05-06 | Added Inactive tab. Auto "Ending Soon" + "Expired" classification. |
| 2026-05-06 | SoT status writes (col H). Active Roster gets editable status dropdown. |
| 2026-05-06 | Onboarding lifecycle: pinned to top of Active Roster, distinct color. |
| 2026-05-06 | Status pills repainted to match the Sheet's chip palette. "Ending Soon" added as a manual option. |
| 2026-05-06 | Deployed to Vercel as `global-contractor-dashboard.vercel.app`. |
| 2026-05-06 | Built custom password gate (Hobby plan can't use Vercel's password feature). |
| 2026-05-06 | Renamed project → `speak-ctr-hojicha.vercel.app` to make the URL less guessable. |
| 2026-05-08 | **Replaced password gate with Google OAuth (NextAuth v5)**. Hardcoded 4-email allowlist (Shihyun / Sunjae / Hemmi / Mina). Created OAuth client in GCP project `shihyun-gws`, Internal user type. Removed `DASHBOARD_PASSWORD` + `DASHBOARD_AUTH_SECRET`, added `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `AUTH_SECRET`. |
| 2026-05-08 | Sign-out button in dashboard header. Login page gets a "Request access" mailto link to Shihyun, plus a clear "Account not on the access list" panel when NextAuth returns `error=AccessDenied`. |
| 2026-05-08 | Slack DM alert on every denied sign-in attempt — fire-and-forget POST to `SLACK_AUTH_ALERT_WEBHOOK` with denied email + name + timestamp. |
| 2026-05-08 | Replaced the broken envelope emoji on "Request access" with an inline SVG icon (system emoji font wasn't rendering it). |
| 2026-05-08 | "Request it" mailto link → **inline access-request form** (Name / Work email / Reason) on the sign-in page. Server action posts to `SLACK_AUTH_ALERT_WEBHOOK` (reuses the existing webhook instead of adding a Bot Token). Solves the silent-failure case where the user's browser had no `mailto:` handler. |
| 2026-05-08 | **Sign-out fix**: NextAuth's POST `/api/auth/signout` was failing in prod with `MissingCSRF`. Replaced with a custom `/signout` route handler that explicitly expires all 12 known NextAuth cookies (unprefixed + `__Secure-`/`__Host-` variants) with matching `Path=/`, `SameSite=lax`, and `Secure` flags. Initial attempt also expired chunked variants (`.0–.9`) but 120 `Set-Cookie` headers exceeded Vercel's response header limit and returned 500; trimmed to the 12 base names. |
| 2026-05-08 | Added `AUTH_URL=https://speak-ctr-hojicha.vercel.app` and `AUTH_TRUST_HOST=true` to fix `MissingCSRF` errors caused by NextAuth setting cookies on whichever host the request arrived on (the project had two `.vercel.app` aliases active). |
| 2026-05-08 | Removed the `global-contractor-dashboard.vercel.app` deployment alias so there's only one canonical URL — `https://speak-ctr-hojicha.vercel.app`. Note: `vercel --prod` re-creates the global-contractor-dashboard alias on every deploy, so a manual `vercel alias set <new-deploy> speak-ctr-hojicha.vercel.app` is required after each deploy until that auto-alias is reconfigured. |
| 2026-05-08 | Header subtitle: "Friendlier UI for the Contractor Lifecycle Google Sheet." → "Live mirror of the Contractor Tracker sheet." Layout metadata description updated to match. |
| 2026-05-08 | Announced to the People Ops channel — message draft kept at `00-inbox/contractor-dashboard-announcement.md`. |
| 2026-05-12 | **New columns for all 4 request tabs**: Onboarding (Scope, Payment Rate, Working Location, SaaS Tools), Extension (Scope, Payment Rate, Scope/Rate Changed?), Offboarding (Reason, Notified?), Rate Change (New Payment Rate). Extension's Job Title + Scope + Payment Rate sourced from the matching Onboarding row (Extension tab only has 6 cols). Onboarding parser widened to A:R. |
| 2026-05-12 | **SoT new columns**: Job Title, Department, Start Date — later moved Job Title + Department back to a Name-cell subtitle for compactness; Start dropped from Active Roster (kept on Inactive). |
| 2026-05-12 | **Active Roster pending-change preview**: Contract end cell shows `current → proposed` when an Extension (Pending/Action Required/blank) or early Offboarding exists for that contractor. Indigo for extension, red for offboarding. Earliest pending change wins on conflict. |
| 2026-05-12 | **Date format → MM/DD/YYYY everywhere**, with Active Roster using compact MM/DD when current year. Single `fmtDate` + `fmtDateShort` in `lib/dates.ts`. |
| 2026-05-12 | **Offboarding → SoT Status auto-sync (col H)**: pending offboarding → `Ending soon`; completed → `Ended`; void → no-op. Col H is plain values everywhere — no formulas touched. |
| 2026-05-12 | **Extension Active → SoT End Date auto-sync (col G)**: writes Extension's New End Date to SoT col G. Overwrites the MAXIFS formula in that cell intentionally — matches the existing manual workflow when extensions or early offboardings happen. ~80% of col G rows are formula-driven, the other 20% were already manually overridden by predecessors. |
| 2026-05-12 | **Offboarding earlier-than-SoT → col G auto-sync**: if Offboarding's End Date < current SoT End Date, writes the earlier date. Doesn't write if offboarding date >= SoT date (no-op for normal end-of-contract offboardings). |
| 2026-05-12 | **Slack DM audit log** for every SoT End Date write via `SLACK_AUTH_ALERT_WEBHOOK` (confirmed DMs Shihyun directly). Format: `🗓 Auto-synced SoT End Date for {name} (row N): {from} → {to} (trigger: extension/offboarding)`. |
| 2026-05-12 | **Owner pill split**: APAC (green) / US (amber) / RoW (blue) / ? (grey). US derived from country starting with `US ·` after the `formatCountry` pass. Routing logic unchanged — Hemmi still owns both US and RoW. |
| 2026-05-12 | **Country normalization** (`lib/owners.ts` → `formatCountry`): US states → `US · California` / `US · Massachusetts`; strips trailing `, US` / `, U.S.` / `, USA` / `, United States` (regex fix: original `u\.?s\.?a\.?` required `a` to be present, broke on `California, US`); 2-letter country codes mapped (`KR`→South Korea, `JP`→Japan, `TW`→Taiwan, etc.); `CA` and `AR` intentionally left as US states (Canada/Argentina users must spell out). |
| 2026-05-12 | **TruncatedCell popover**: long fields get `…` + click-to-expand panel. Uses `position: fixed` anchored to the trigger's bounding rect so it escapes the table's `overflow-x-auto` clipping. Recomputes on scroll/resize; flips left if it would overflow viewport right edge. |
| 2026-05-12 | **Columns toggle** lifted to the parent filter row (was floating above each table). Hidden-cols state persisted per-tab in localStorage. Only renders when current tab has extras. |
| 2026-05-12 | **Urgency badges compacted** from `5 working days left` to `5d left` / `2d ago`. Full label on hover via `title=`. |
| 2026-05-12 | **Status select width capped to 130px** (was sprawling, dominated rows). |
| 2026-05-12 | **Dropped redundant "⚠ Ending Soon (auto)" subtitle** under the SoT status chip — the chip already conveys it. Kept "Past end date" + "Sheet data error" subtitles for actual issues. |
| 2026-05-12 | **Payment Rate formatter**: bare numbers get `$` prefix; appends `/hr` / `/mo` / `(project)` based on the Onboarding form's Type of Contract Payment column. |
| 2026-05-12 | **Infinite scroll pagination**: 20 rows per page via IntersectionObserver on the last visible row. Footer shows `Showing X of Y — scroll for more`. Resets on tab/filter/sort change. Applies to all 6 tabs. |
| 2026-05-12 | **Name cell width capped** at 22ch so long names ("Floriane Elise Turcat", "JIN HYEONG LEE") wrap to 2 lines instead of widening the column. |
| 2026-05-12 | **Request-tab subtitle**: dropped the redundant `Onboarding ·` / `Extension ·` prefix (the active tab already conveys it). Now shows just `Job Title · Department`. |
| 2026-05-12 | Search expanded to cover all new fields: job title, department, scope, working location, SaaS tools, reason, payment rate, new payment rate. |
| 2026-05-12 | **Onboarding/Extension → Active → SoT col H = `Active`**. Refactored the offboarding-only `syncSotStatusFromOffboarding` into a generic `deriveSotStatusFromRequest(source, status)` + `writeSotStatus(name, status)` pair so all three request tabs can drive SoT lifecycle writes. Rate Change deliberately excluded — orthogonal to lifecycle. |
| 2026-05-12 | **Extension End Date sync uses latest Active extension**, not the row being clicked. Handles the case where a contractor has multiple Active Extension rows (old + new) — we want SoT col G to reflect the final/latest extension date. New helper `latestActiveExtensionEndDate(name)` scans all Active extensions for the contractor and returns the most-recent end date. |
| 2026-05-12 | **Closed/completed request rows kept in view but pinned to bottom of each request tab, greyed out** (50% opacity, hover restores). Parsers now emit a `closed: boolean` on every RequestEntry rather than filtering closed rows out. Tab badge counts only show open rows so closed visibility doesn't read as "more to do". |
| 2026-05-12 | **Collapse closed rows behind a `▸ Show N completed` toggle**. Default collapsed; resets on tab/filter/sort change. Solves the "tab looks busy when there's nothing to do" problem. |
| 2026-05-12 | **Closed-flag recomputes on optimistic status flip**. `applyOverrides` now calls `isClosedStatus(source, status)` (newly exported from parsers) so a flip moves the row between open and completed sections without waiting for a refresh. |
| 2026-05-12 | **Optimistic SoT side-effect propagation**. When a request-tab status change triggers a SoT col H/G write, the dashboard now consumes the server's `sotSync` + `sotEndSync` response and applies them to local `sotOverrides` + new `sotEndOverrides` maps. Active Roster's status pill + end date update immediately without a manual refresh. `classifySot` was exported from parsers so the client can re-run lifecycle classification after applying overrides (e.g. Offboarding Completed → SoT "Ended" → row drops to Inactive tab). |
| 2026-05-12 | **Request date matching (Form Responses → request tab)**. New `loadRequestTimestamps()` reads Form Responses col A (timestamp) + E (request type) and returns a Map keyed by `${canonicalName}::${kind}` → ISO date list. Each loader pops from the matching list in order. Default sort on the 4 request tabs is `requested` desc (newest first). |
| 2026-05-12 | **Request date timestamp ordering bug fix** — `loadRequestTimestamps` was sorting lists newest-first then `shift()`-ing, which gave the FIRST row (oldest by sheet order) the NEWEST timestamp. Switched to oldest-first sort so the natural top-down sheet order matches form-submission order. This was the root cause of "Minjin's pending arrow keeps showing" — row 50 was getting row 70's timestamp, so the stale-Pending suppression couldn't see it as older. |
| 2026-05-12 | **Active Roster: hide pending-extension arrow when proposed end matches current SoT end** (no actual change being proposed) and when a later Active extension exists for the same person (stale Pending). Suppresses misleading `09/12 → 05/12` arrows like Minjin's row 50 and Katya's `11/02 → 11/02`. |
| 2026-05-12 | **`pendingEndChange` reads override-merged status** so optimistic flips in the Extension tab take effect on Active Roster's arrow immediately. |
| 2026-05-12 | **Country normalization moved upstream of owner routing**. `ownerFor(country)` now runs through `formatCountry()` first, so `KR`, `HK`, `JP`, etc. resolve to their canonical name before APAC matching. Fixes "Hong Kong contractor shows as RoW" and "Seoul shows as RoW" bugs. |
| 2026-05-12 | **APAC list broadened to cover most of Asia + Oceania**: added Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan, Maldives, Afghanistan, Mongolia, Cambodia, Laos, Myanmar, Brunei, Timor-Leste, Macau, Fiji, PNG. Plus city/region aliases: `Seoul`, `KR Seoul`, `Tokyo`, `Osaka`, `Taipei` → their countries. |
| 2026-05-12 | **Manual sheet fix for Minjin Oh** — SoT row 47 col G was stale at `5/12/2026` from before the auto-sync existed. Wrote `9/12/2026` directly via `gws sheets values update` to match her latest Active Extension (row 70). |
| 2026-05-12 | **Urgency badge color split**: "past end date" (`Xd ago`) renders as dark slate (`bg-slate-800 text-white`) instead of red, distinguishing it from "ending soon" (still red). |
| 2026-05-12 | **TruncatedCell popover overhaul**: switched to `position: fixed` with computed coords from the trigger's bounding rect so the panel escapes the table's `overflow-x-auto` clipping. Recomputes on scroll/resize; flips left if it would overflow viewport right edge. |
| 2026-05-12 | **Subtitle filter** — Job Title / Department subtitles skip values that match `#N/A` / `#REF!` / etc. via new `isMeaningfulText()`. Same filter applied to Manager + Approver cell text so error placeholders render as `—`. Inactive tab no longer has uneven row heights from `#N/A` subtitles. |
| 2026-05-12 | **Name + Manager + Approver columns** now have width caps (`max-w-[22ch]` / `max-w-[16ch]`) and wrap to 2 lines instead of `whitespace-nowrap`. Keeps columns narrow when contractor or manager names are long. |
| 2026-05-12 | **Header rename**: `Contract end` → `End date (MM/DD)` on both Active Roster and Inactive (shared SotTable). |
| 2026-05-12 | **Requested column removed from view** (sort by Requested still available as the default; column itself dropped per request). Colspan helpers updated to match. |
| 2026-05-12 | **Latest-active-extension lookup for col G sync**: when Extension flips to Active, `syncSotEndDate` now uses `latestActiveExtensionEndDate(name)` instead of the clicked row's New End Date. Fixes the case where the user clicks an older Active Extension and we don't want to clobber col G with that older date. |
| 2026-05-20 | **Diagnosed Wang Heng Chen "disappearing" from Active Roster**: SoT row 32 had `End Date = 2/27/2026` (the original onboarding end), but she had an Active extension to 5/31/2026 filed under the name variant `Heng Chen Wang` (canonical mismatch with `王姮臻 Wang Heng Chen`). Classifier saw past end date → routed her to Inactive tab as "Expired". Manually fixed col G in the sheet; longer-term fix would be a name alias in `lib/owners.ts`. |
| 2026-05-20 | **Daily cron to reconcile SoT col H** (`lib/reconcile.ts` + `app/api/contractors/cron/reconcile-status/route.ts` + `vercel.json`). Runs at 8:50am KST Mon–Fri (just before the 9am digest reads the sheet). Forward flip: Active + end within 10 working days → "Ending soon". Reverse flip: "Ending soon" + end pushed past 10 days → "Active" (only flips away from the auto-set value; manual statuses untouched). Silent — Vercel cron logs + Sheets revision history are the audit trail. Gated by `CRON_SECRET` env var (must set on Vercel before first deploy). Committed in `f8ea9e3`. |
| 2026-05-21 | **Adjacent system — Slack digest APAC routing fix + regression guardrail.** Reminder bot (`peopleops-automations` repo) was routing KR/TW/JP contractors to RoW because `owner_for("KR")` failed the substring check `"korea" in "kr"`. Added `_COUNTRY_ALIASES` table mirroring the dashboard's `lib/owners.ts` (commit `bcc7cb2`). Followed up with an `audit_owner_routing()` self-check inside `build_digest()`: every digest now compares each contractor's `(country, owner)` pair against a curated `_KNOWN_APAC_VALUES` list, and any mismatch surfaces as a `⚠️ Routing regression detected` warning at the top of the digest. Commit `464d67b`. Three places to update when adding a new APAC country: `APAC_COUNTRIES`, `_COUNTRY_ALIASES`, and `_KNOWN_APAC_VALUES`. |
| 2026-10-27 | **Pre-deploy prep for the SoT cron** (not deployed yet). Found prod was still the 5/12 deploy (`dpl_GD6E6Ep43S4W3LsJjkTyRfBn3VP9`); only the 5/20 cron + `owners.ts` token matching were undeployed. Added `/api/contractors/cron` to middleware public prefixes (cron would otherwise 401 with no session). Added `?dryRun=1` to the cron route. Fixed token matching: 2-letter tokens only count in caps ("Spain or Armenia" was becoming `US · Oregon`). Dry run: 4 flips Active → Ending soon (rows 4, 70, 84, 121). `CRON_SECRET` still not set on Vercel. Restore point: git ref `refs/backups/13b-2026-10-27`. |
| 2026-10-27 | **Deployed** (`dpl_Aaw1P2mSBGL3aWcd4UCmtDJFWSpj`), aliased to `speak-ctr-hojicha.vercel.app`, removed the auto-recreated `global-contractor-dashboard` alias. `CRON_SECRET` set (Shihyun ran it). Cron registered: `50 23 * * 0-4` UTC (8:50 KST Mon-Fri). **Rollback note:** cron targets the deployment, so an alias swap alone won't stop it; use `vercel rollback speak-ctr-hojicha-krysmnepz-shihyunl-7107s-projects.vercel.app` (or remove the cron). New CLI prints JSON on stdout, so `URL=$(vercel --prod)` no longer works for the alias step. |
| 2026-10-27 | **Activity tab (automation log)**, deployed `dpl_ATvYtG88cMcC39swaVxCKW9VLgDz` (cron moved to this deploy too). Log lives in a separate sheet `POps Automation Log` (`1okDnmzfjdHYwQJSCKIfO-H0VYx56Q_7frPpGc0bDzck`, Shihyun's Drive, ctr-bot = editor). `lib/activityLog.ts` (best-effort append, never throws; kill switch `ACTIVITY_LOG_SHEET_ID=off`), `GET /api/activity`, `components/ActivityLog.tsx` (per-automation cards, failed-only filter, search). Logged: SoT status sync cron (run summary + per-person rows) and SoT auto-sync side-effects in the status route (who triggered it). Reminder bot logging is on branch `feat/automation-log` in peopleops-automations (uncommitted; push was blocked, needs Shihyun). |
| 2026-10-27 | **Redesign prototype** (fake data, not wired): https://claude.ai/artifact/LSNnZ3CBg2oSQPCekspikS. Today action queue home (requests waiting, ending in 10 working days with nothing filed, failed automations, data fixes) + next-30-days end dates + roster by owner; Contractors as grouped cards with contract progress; profile drawer (open requests with actions, contract, history incl. automation log); Requests as one list across types; Activity. My queue (APAC) vs Everyone toggle. Undo toast on actions. |
| 2026-10-27 | **Redesign phase 1 (groundwork), local only, not deployed.** Restore point `refs/backups/13b-redesign-p1`. `lib/plans.ts` (4 agreed action plans; request key = type:canonicalName:requestedAt, all 307 requests have one, no collisions), `lib/steps.ts` + `GET/POST /api/steps` (append-only ticks in new `Steps` tab of the POps Automation Log sheet, latest wins), `lib/regions.ts` (APAC / US + RoW / All; default region by viewer), `app/v2/page.tsx` shell with Geist. Finding: extension 'Scope/Rate Changed?' is free text, so `readChangeAnswer` reads only clear answers (75 no / 6 yes / 25 unclear of 106); unclear ones need a human Unchanged/Changed call saved as step `changed`. |
| 2026-10-27 | **Redesign phase 2 (Open items) built at `/v2`**, deployed `dpl_DEs3uGz2cwqTATdt1z9YfhfCHT62` (rollback target: `speak-ctr-hojicha-8ywdvdbiz-shihyunl-7107s-projects.vercel.app`). `app/v2/page.tsx` + `hub.css` (scoped `.hub`), `components/v2/HubApp.tsx` (nav, region switcher, toasts, step + status writes), `components/v2/OpenItems.tsx` (4 type tabs, stage grouping, checklists, extension Unchanged/Changed choice, two-click final action = existing status PATCH, Needs info / Unblock, Ending soon nothing filed with copy-to-clipboard Ask manager, key-date side column). Tested with live data and intercepted writes: render, tick, confirm → correct PATCH. Roster / Automations show 'coming next'. |
| 2026-10-27 | Removed 'auto' tags for automations that don't exist yet (DocuSign draft, Amendment signed, New contract signed); only 'Form' remains. Re-tag each step when its automation goes live. |
| 2026-10-27 | Offboarding 'Request access removal (IT)' step gets a **Copy message** button: name, email (from the contractor's latest Onboarding row, col E; new `email` field on onboarding entries), last day. No timezone (Shihyun: date is enough). |
| 2026-10-27 | Fix: Copy message button overlapped the 'Request access removal (IT)' label (both were width 100% on one row); helper buttons now sit on their own line under the step. Checked with a headless Chrome screenshot of a live-data render (`renderToString` + hub.css). |
| 2026-10-27 | **Profile panel on /v2** (`components/v2/Profile.tsx`): click any name on Open items → SoT contract facts + every form submission for that person (all 4 types, newest first, with what was submitted; open ones show step progress). Past extensions show only the requested new end date, because `priorEndDate` is the *current* SoT end, not the end at request time. Data note: Oka Kawakami's SoT end is 2026-09-12 (past) while her offboarding last day is 2026-11-06. |
| 2026-10-28 | Onboarding plan revised with Shihyun: Form submitted (auto) → DocuSign draft created → Contract sent out + onboarding email → DocuSign completed (all signed; future auto-tick from signed alert) → Speak email / tool setup if needed → Deel (or other HRIS) setup done → Mark Active. Step ids: form, draft, contract_sent, signed (new), setup (new), hris (new; old `welcome` retired, no live ticks used it). |
| 2026-10-28 | **DocuSign signed → auto-tick** (not yet live). New `POST /api/hooks/docusign-completed` (bearer `DOCUSIGN_HOOK_SECRET`, `/api/hooks` public in middleware): matches signer email to the contractor's onboarding email (fallback: name), ticks `signed` (onboarding) / `contract_signed` (rate change) / `amend_signed` (extension) on open requests, skips if already ticked, logs OK / Skipped / Failed to the automation log. Bot side on branch `feat/automation-log` in peopleops-automations: best-effort `notifyDashboard()` after the Slack post (4s timeout; never affects Slack or DocuSign retries), env `DASHBOARD_HOOK_URL` + `DASHBOARD_HOOK_SECRET`. Tested against a temporary sheet copy (trashed after): 401 on wrong secret, email match (case-insensitive, finance signer ignored), no-match → Skipped, read failure → Failed logged. Note: Sheets read quota is 60/min for the service account; one hook call ≈ 8 reads. Tag the steps 'DocuSign' only after the bot is deployed and a real envelope ticks. |
| 2026-10-28 | Profile shows **every submitted answer**: new `lib/submissions.ts` + `GET /api/profile?name=` read the person's rows from 'Form Responses' (all ~30 questions, empty + 'Column N' dropped; 'Your Name' → Submitted by, 'Email Address' → Submitter email), matched to request-tab rows by type + submission date for status / step progress. Question-above-answer layout (long questions squeezed answers to 1 char wide side-by-side; caught by screenshot). Falls back to the old summary if Form Responses can't load. |
| 2026-10-28 | **First real SoT cron run verified**: 23:53 UTC (08:53 KST), 4 updated (Katya Hadjipetkova, Maki Hirano, Tsai I-Shan, Angela Torres), 0 failed, summary + per-person rows in the automation log. Dashboard deploy with DocuSign hook live; `DOCUSIGN_HOOK_SECRET` set (dashboard), `DASHBOARD_HOOK_SECRET` + `DASHBOARD_HOOK_URL` set (docusign-completed-alert). Bot deployed 2026-10-28 (`dpl_oQNN5fX848tHtH3G5wAkymWfPyVD`, from local branch `feat/automation-log`, uncommitted): stable URL serves it, bad signature still 401. **Waiting on the first real signed envelope** to confirm end to end; then add `auto: "DocuSign"` to the signed steps. Branch still needs push + PR. |
| 2026-10-28 | Default view for everyone: region All → Open items → Onboarding tab (per-person region defaults removed). Open items always opens on the Onboarding tab (was: first tab with open items). |
| 2026-10-28 | Step names refined to finished-state wording (ids unchanged, ticks kept): Onboarding = Form received / DocuSign draft ready / Contract + onboarding email sent / Contract signed by all / Speak email & tools set up (if needed) / Added to Deel / HRIS; Extension = Scope & rate confirmed / Amendment sent (DocuSign) / Amendment signed / End date updated in Deel / Contractor informed; Offboarding = Last day confirmed / Contractor informed / Terminated in Deel / Access removal requested (IT); Rate Change = New contract sent (DocuSign) / New contract signed / Rate updated in Deel / Contractor informed. Profile sections are `<details>` toggles: Contract + newest form open, older forms collapsed. |
| 2026-10-28 | Tagged 'Automatic' on the steps the DocuSign hook ticks: Contract signed by all (onboarding), New contract signed (rate change), Amendment signed (extension). Shihyun asked to tag now (hook + bot deployed; first real envelope still to confirm). New Copy message on onboarding 'Speak email & tools set up (if needed)': IT request with name, personal email, role, start date, manager, tools from the form. Copy buttons now driven by a `COPY_FOR` map (`source:stepId`). |
| 2026-10-28 | Removed the middle dot from /v2 copy (Shihyun's preference): separators are now commas / colons. Shared `formatCountry` now returns "US, California" (was "US · California"); old dashboard's `regionTagFor` check updated to match. Old dashboard layout still has a few dots (left as is; /v2 replaces it). Deployed `dpl_679zdkxwr4DaeorbD4weSWpH7PsL`. |
| 2026-11-02 | IT copy messages trimmed to name / date / systems (tools from the onboarding form; removal looks up the latest onboarding row); setup adds a `New Speak email: [ ]@usespeak.com` placeholder. Deployed `dpl_3UDvJkdWWN8y9oYSUFXAqXKCEmtd`. |
| 2026-11-02 | **Phase 3 Roster (v1) at /v2**: `components/v2/Roster.tsx`. Active / Inactive tabs (Inactive = SoT Status Ended / Void / Voided), grouped by the raw SoT Status text exactly as the Sheet has it (no auto Ending Soon / Expired), sheet row order, row # column, search, region filter, names open Profile. Read-only. Flags "Past end date" on non-inactive rows whose end date passed (13 today). 14 rows have a blank Status and show as "No status". Timeline / Data to fix still to come. Deployed `dpl_2Y3T33xcKsN6CBFCaogpvC3GQ7Q6`. Same day: switched to one tab per Sheet Status value (Onboarding / Active / Ending soon / Action Required / No status / Ended / Voided, only values present; Active always shown), tab color = Sheet chip color (Shihyun picked tabs over collapsible sections). |
| 2026-11-02 | **Manual status changes in /v2** (Shihyun: "any way to update the status if you check the checklist wrong"). `components/v2/StatusSelect.tsx` = dropdown with the Sheet's own values (`lib/statuses.ts`), `window.confirm` before writing, confirm text lists the SoT side-effects (`sotSideEffect`). Placed on: each request in Profile (fixes a wrongly closed request), SoT status in the Profile header, and a Status column in Roster. Writes go through the existing `/api/contractors/status` PATCH; `HubApp` keeps `sotOverrides` (also fed by `sotSync` from request writes) so Roster tabs / nav count update without a refresh. Note: reverting a request does NOT undo earlier SoT end-date writes; fix col G by hand. |
| 2026-11-04 | **Hemmi feedback on Open items cards** (`fieldsFor` in `components/v2/OpenItems.tsx`): (1) Scope added to Onboarding and Extension cards (Extension scope comes from the matching Onboarding row), collapsed behind a "Show scope" toggle (`details.reveal` in `hub.css`; Shihyun 11/4, replaced an earlier 3-line clamp); (2) Onboarding "Location" (Onboarding col Q, working location) replaced by "Country of residence" = `formatCountry(r.country)` from Form Responses, so US shows "US, California". Hidden when the country is unknown. Deployed `dpl_7EvyRyBYtGmeKNeBzQnZugBkNwvP`. |
| 2026-11-04 | **Request status follows the checklist** (Shihyun): removed Needs info / Unblock and the separate "Action Required" stage. `HubApp.wantedStatus`: nothing ticked beyond "Form received" = `Action Required`, anything ticked = `Pending`; written on each tick and, on page load, for any open request out of line (dry run 11/4: 3 open requests, all already in line, so 0 writes). Final status (Active / Completed) stays a separate confirm click because it writes to the SoT (Shihyun chose this over fully automatic). Not added to the nightly cron either (Shihyun 11/4: "automatic could be too error-prone"), so new rows only flip when someone opens /v2. Side note: the Slack reminder bot prints non-Pending statuses, so new requests will show "Action Required" there. |
| 2026-11-04 | **Shared date calendar** replaces the per-tab date list on the right of Open items (`components/v2/DateCalendar.tsx`). One month grid on every tab with all four types' key dates (Start / Current end / Last day / Rate effective), dots in the type colors; current tab solid, others faded. Click a day to list just that day; below the grid, the month's list with type pill; "N earlier" / "Next: date" jumps; Today button. Region filter applies. Not browser-tested (sign-in). |
| 2026-11-04 | **D-day + clearer request age on Open items cards** (Shihyun): pill next to the name counts calendar days to each type's key date: "D-5 to start" (onboarding), "D-12 to end date" (extension, current end), "D-3 to last day" (offboarding), "D-7 to rate change" (effective date); amber when 3 days or fewer, grey "... was N days ago" when past. "4d waiting" → "Requested 4 days ago" (calendar days; still red when over 3 working days). |
| 2026-11-04 | **Automations tab → "What's new"** (Shihyun): changelog for the team. Entries live in `lib/updates.ts` (date, New / Changed / Fixed, title, body; no credits, Shihyun 11/4), rendered by `components/v2/Updates.tsx`, grouped by day. Nav shows a blue dot until that browser has opened the tab since the newest entry (localStorage `hub.updatesSeen`). **Add an entry to `lib/updates.ts` with every user-facing deploy.** Phase 4 Automations UI is shelved for now. |
| 2026-11-04 | /v2 sidebar: "Signed in as" + Sign out at the top (same `/signout` POST as the old page; `viewerEmail` prop from `app/v2/page.tsx`), "Owner: shihyun.l@usespeak.com" mailto at the bottom. Access was already gated (checked: `/v2` 307 → /login, APIs 401 signed out). |
| 2026-11-04 | Login / signed-out page restyled to match /v2 (`app/login/page.tsx` wraps in `.hub` + Geist, imports `../v2/hub.css` + new `app/login/auth.css`; brand "Contractor Hub"; "Sign in again" after sign-out; dark mode via hub tokens). Logic unchanged (Google sign-in, access-request form to Slack). Checked locally with headless Chrome screenshots (signed-out + request form). |
| 2026-11-04 | **Phase 5 switch-over (Shihyun):** the redesign is now `/` (`app/page.tsx`, was `app/v2/page.tsx`), the old dashboard moved to `/classic` (`app/classic/page.tsx`), `/v2` redirects to `/`. `hub.css` moved to `app/hub.css` (login imports it). Sidebar link is now a "Classic view (v1)" button; old dashboard got a "New view" button next to Sign out. Skipped the planned week of team trial on /v2. Announce in #global-contractor-dashboard still to do. |
| 2026-11-04 | "Ending soon, nothing filed" moved to the top of Open items on every tab (was only at the bottom of Extension / Offboarding), hidden when empty; countdown uses the same D-day pill (calendar days). Removed the "Preview" tag from the Open items header (it is the main page now). |

## Planned: redesign (from prototype https://claude.ai/artifact/LSNnZ3CBg2oSQPCekspikS)

Agreed 2026-10-27. Nav = Open items (4 separate request tabs, each grouped by its own stages) | Roster (contract timeline by SoT status) | Automations (controls + log). Regions APAC / US + RoW / All. Geist font, neutral look.

**Phase 0 answers so far:** Onboarding = Form submitted → DocuSign draft created → Review & send out the contract → Onboarding email sent / tool setup if needed → Mark Active. Extension (no change) = Confirm scope and rate unchanged → Update end date in Deel → Inform contractor → Approve; if scope/rate changed, insert Send amendment (DocuSign) → Amendment signed before Deel (branch pre-set from the form's 'Scope/Rate Changed?' answer). Offboarding = Check the last day → Inform contractor → Terminate on Deel → Request access removal (IT) → Mark Completed. Rate Change = Send new contract (DocuSign) → New contract signed → Update rate on Deel → Inform contractor → Mark Completed. All four confirmed 2026-10-27.
**Phase 0 decisions (2026-10-27, done):** ticks saved in a new `Steps` tab of the POps Automation Log sheet; 'Ask manager' copies a Slack message (managers change, so no auto-DM); everyone sees all regions, default region: Shihyun APAC, Hemmi US + RoW, Sunjae / Mina All.
**Phase 0 (original questions):** final steps for Extension / Offboarding / Rate Change; where step ticks live (proposal: new `Steps` tab in the POps Automation Log sheet, not the contractor Sheet); "Ask manager" = copy message (v1) vs Slack DM; confirm Sunjae / Hemmi / Mina see everything.
**Phase 1, foundation (no visible change):** `lib/plans.ts` (steps per type), stable request key (`type:canonicalName:requestedDate`, already derived from Form Responses), `Steps` storage + API, region mapping (us+row → usrow), default region by viewer email. New UI built at `/v2`; `/` stays the current dashboard.
**Phase 2, Open items:** 4 type tabs, stage grouping, checklist ticks, trigger button = existing status PATCH (keeps SoT auto-sync + log), Ending soon / nothing filed on Extension + Offboarding.
**Phase 3, Roster:** v1 LIVE 2026-11-02 (`dpl_2r7DygzFTVz5YxxM5NSxBuJXte9K`): one tab per Sheet Status, sheet row order, search, Status dropdown per row, "Past end date" flag. Still to do: timeline (pending extension new end, offboarding date), sort, Data to fix (14 blank-status rows, 13 past-end-date rows not Ended/Voided).
**Start here next (as of 2026-11-04):** (1) Shihyun to check Roster + the status dropdowns live (not browser-tested by Claude, needs sign-in); (2) 1:1 with Hemmi / Sunjae: ask which step takes longest, automate that first; (4) optional Undo on final actions (restore request status + SoT status + old end date) was offered, not built; (5) clean the Sheet rows Roster flags.
**Phase 4, Automations (shelved 11/4, nav slot is now What's new):** cards from config + last run from log; SoT sync Dry run / Run now via server action; Pause via a `Settings` tab flag the cron reads. Reminder bot controls need the bot PR merged + a GitHub token (later).
**Phase 5, switch over (done 11/4, old view at /classic; remove /classic once nobody uses it):** team uses `/v2` for ~1 week, then `/v2` becomes `/`, old view kept at `/classic` for a few weeks; announce in #global-contractor-dashboard.
**Later:** auto-tick steps from DocuSign: 'DocuSign draft created' (13c), and 'New contract signed' (rate change) / 'Amendment signed' (extension) from the signed-alert bot by matching signer name to the open request (Shihyun wants this). Deel steps.

## Planned: "Send contract" via DocuSign

Planned as its own project; see [`../13c-docusign-contract-automation/progress.md`](../13c-docusign-contract-automation/progress.md). Will be built into this dashboard.

## Known gaps / things that could break

- **Form Responses country lookup misses ~6 SoT rows** — older contractors who never went through the new form. Their cards show "Unknown" owner. Workflow: update the contractor's country field in their Form Responses row directly. (We discussed adding a click-to-reassign UI backed by an "Owner Overrides" sheet tab but punted — manual sheet edit is fine for now.)
- **Duplicate-name SoT rows** — some contractors appear in SoT twice (e.g. Katya / Ekaterina Hadjipetkova) because of alias resolution + manual SoT entries. Could cause arrow/sync logic to behave on whichever row gets matched first. Tolerable for now.
- **Vercel CLI 52 → 53 upgrade pending** — current CLI works, but a session reminder noted 53.x is available.
- **`#N/A` rows in SoT** — caught by the parser as `Data error` and shown in the Inactive tab in red. Real fix is in the sheet (broken VLOOKUP formulas).
- **Allowlist is hardcoded in `auth.ts`** — adding/removing a teammate is a code edit + redeploy. Could move to a Google Sheet or env var if it churns.
- **SoT End Date writes destroy the col G formula** — each Extension Active or early Offboarding auto-sync replaces the MAXIFS formula with a plain date. That row becomes permanently manually-maintained from then on. Slack audit log preserves history, but the sheet itself loses the formula contract. This is intentional and matches the pre-existing manual workflow, but worth flagging if someone re-introduces the formula and expects future syncs to skip it.
- **No status-write audit log** — Sheet's own version history (File → Version history) shows the edit. SoT End Date writes DO have a Slack audit log; col H Status writes don't. Considered acceptable for now since only 4 known people can sign in.
- **`CA` / `AR` ambiguity**: `formatCountry` treats them as US states (California/Arkansas), not Canada/Argentina. Users typing the country must spell out the full name.

## What this dashboard is not (yet)

- No ticketing / per-request lifecycle state — see `../next-iteration.md`.
- No write-back beyond Status — start dates, end dates, manager, etc. are read-only.
- No DocuSign / Deel integration.
- No history / audit log of who changed what status when.

## Operational notes

- **Add or remove someone**: edit the `ALLOWLIST` in `auth.ts`, then `vercel --prod --yes`. Removed users with active sessions stay logged in until their JWT expires (30 days max) or until `AUTH_SECRET` is rotated.
- **Force-logout everyone**: rotate `AUTH_SECRET` — `vercel env rm AUTH_SECRET production -y` → `vercel env add AUTH_SECRET production --value "$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" -y` → `vercel --prod --yes`. Invalidates every existing session JWT immediately.
- **Sign-in alerts**: denied attempts post to `SLACK_AUTH_ALERT_WEBHOOK` (currently DM to Shihyun). Successful sign-ins are not alerted.
- **OAuth client lives in GCP**: project `shihyun-gws` → Credentials → `speak-ctr-hojicha`. Authorized redirect URIs include both `https://speak-ctr-hojicha.vercel.app/api/auth/callback/google` (prod) and `http://localhost:3000/api/auth/callback/google` (dev). If you ever rename the Vercel project again, update the redirect URI.
- **Pull Vercel env vars into local `.env.local`**: `vercel env pull .env.local`.
- **Logs**: Vercel dashboard → Project → Logs. Function runtime is Node.js 24.
- **Deploy in one step**: `./scripts/deploy.sh` (deploys, sets the speak-ctr-hojicha alias, removes the global-contractor-dashboard alias).
- **Re-alias after deploy**: `vercel --prod` auto-aliases each deploy to `global-contractor-dashboard.vercel.app` (which we removed) instead of `speak-ctr-hojicha.vercel.app`. After every prod deploy run `vercel alias set <new-deployment-url> speak-ctr-hojicha.vercel.app`. The deployment URL is in the `vercel --prod` output (`Production: https://speak-ctr-hojicha-XXXXX-...`).
- **Access requests**: when someone submits the inline "Request it" form on the sign-in page, the request lands in the same Slack channel as denied-sign-in alerts (`SLACK_AUTH_ALERT_WEBHOOK`). To grant access, edit the `ALLOWLIST` in `auth.ts` and redeploy.

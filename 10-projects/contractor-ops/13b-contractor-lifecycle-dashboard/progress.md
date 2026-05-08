# Global Contractor Dashboard — Progress Log

> What's been built, where it lives, and what's next. See [`README.md`](README.md) for the user-facing intro and run instructions.

## Live deployment

- **URL**: https://speak-ctr-hojicha.vercel.app
- **Hosting**: Vercel (project `speak-ctr-hojicha`, scope `shihyunl-7107s-projects`)
- **Access**: Google OAuth via NextAuth, hardcoded 4-email allowlist (`shihyun.l@`, `sunjae@`, `hemmi@`, `mina@` — all `@usespeak.com`)
- **Data source**: same Google Sheet as the Slack reminder bot (`1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM`)
- **Service account**: `ctr-bot@shihyun-gws.iam.gserviceaccount.com` (Editor on the sheet)
- **OAuth client**: `765225737444-...apps.googleusercontent.com` in GCP project `shihyun-gws` (Internal user type, so only `@usespeak.com` accounts can attempt sign-in)
- **Last deploy**: 2026-05-08

## What's working today

### Read path
- 5 tabs read live from the sheet via Google Sheets API: `[SoT] Contractor Tracker`, `Onboarding`, `Extension`, `Offboarding`, `Rate Change`.
- Cached server-side for 60s; manual ↻ Refresh button busts the cache instantly.
- Country comes from `Form Responses` cross-referenced by canonical name.
- Owner routing (Shihyun = APAC, Hemmi = US + RoW) mirrors the Slack bot.

### UI
- Sortable tables, not cards (cards didn't scale past ~10 rows).
- Tab strip: Active Roster / Onboarding / Extension / Offboarding / Rate Change / Inactive.
- Filters: owner (APAC / RoW / Unknown / All) + free-text search.
- Status pills match the Sheet's own dropdown chip palette (green Active / yellow Onboarding / peach Ending Soon / red Action Required / dark Ended / gray Voided).
- Active Roster pins **Onboarding** + **Ending Soon** rows above plain Active rows regardless of column sort.
- Inactive tab catches: Status = Ended/Voided, end date in the past (badged "Expired"), or rows with `#N/A`/`#REF!` data errors (badged "Data error").

### Write path
- Status dropdown on every row writes back to the sheet:
  - Request tabs → column A (Status)
  - Active Roster (SoT) → column H (Status)
- Per-tab status allowlists prevent garbage writes.
- Name-vs-row safety probe before each write returns 409 if the sheet was reordered since the page loaded.
- Optimistic UI update with auto-revert + alert on failure.
- "Ending Soon" is normalized to lowercase "Ending soon" on write so the Sheet's own chip color renders.

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

## Known gaps / things that could break

- **Form Responses country lookup misses ~6 SoT rows** — older contractors who never went through the new form. Their cards show "Unknown" owner. Fix: add a manual override map, or backfill the Form Responses tab.
- **Vercel CLI 52 → 53 upgrade pending** — current CLI works, but a session reminder noted 53.1.1 is available.
- **`#N/A` rows in SoT** — caught by the parser as `Data error` and shown in the Inactive tab in red. Real fix is in the sheet (broken VLOOKUP formulas).
- **Allowlist is hardcoded in `auth.ts`** — adding/removing a teammate is a code edit + redeploy. Could move to a Google Sheet or env var if it churns.
- **No audit log of who edited what status when** — Sheet's own version history (File → Version history) shows the edit, but doesn't tie it to a dashboard user. Considered acceptable for now since only 4 known people can sign in.

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
- **Re-alias after deploy**: `vercel --prod` auto-aliases each deploy to `global-contractor-dashboard.vercel.app` (which we removed) instead of `speak-ctr-hojicha.vercel.app`. After every prod deploy run `vercel alias set <new-deployment-url> speak-ctr-hojicha.vercel.app`. The deployment URL is in the `vercel --prod` output (`Production: https://speak-ctr-hojicha-XXXXX-...`).
- **Access requests**: when someone submits the inline "Request it" form on the sign-in page, the request lands in the same Slack channel as denied-sign-in alerts (`SLACK_AUTH_ALERT_WEBHOOK`). To grant access, edit the `ALLOWLIST` in `auth.ts` and redeploy.

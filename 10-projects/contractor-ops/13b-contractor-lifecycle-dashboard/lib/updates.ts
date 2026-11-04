// "What's new" tab in /v2 (Shihyun, 2026-11-04). Newest first. Add an entry
// here with each user-facing deploy; the nav shows a dot until someone has
// opened the tab since the newest entry. Plain words, no middle dots.

export type UpdateKind = "New" | "Changed" | "Fixed";
export type Update = { date: string; kind: UpdateKind; title: string; body: string };

export const UPDATES: Update[] = [
  {
    date: "2026-11-04",
    kind: "Changed",
    title: "This is now the main page",
    body: "speak-ctr-hojicha.vercel.app opens Contractor Hub. The old table view is still there for now: Classic view (v1) at the bottom of the left sidebar. Old /v2 links still work.",
  },
  {
    date: "2026-11-04",
    kind: "New",
    title: "Sign out from here",
    body: "The top of the left sidebar shows who you're signed in as, with a Sign out button, same as the original page.",
  },
  {
    date: "2026-11-04",
    kind: "New",
    title: "What's new tab",
    body: "This page. Each change to the dashboard gets a short note here, newest first.",
  },
  {
    date: "2026-11-04",
    kind: "New",
    title: "Countdown next to each name",
    body: "Open items cards show how many days are left to the date that matters: D-5 to start (Onboarding), D-12 to end date (Extension), D-3 to last day (Offboarding), D-7 to rate change (Rate Change). Amber at 3 days or fewer, grey once the date has passed. Hover for the exact date.",
  },
  {
    date: "2026-11-04",
    kind: "Changed",
    title: "\"Requested N days ago\"",
    body: "Replaces \"4d waiting\". Turns red when a request has sat for more than 3 working days. Hover to see the date the form came in.",
  },
  {
    date: "2026-11-04",
    kind: "New",
    title: "Shared calendar on Open items",
    body: "The date list on the right is now a month calendar with every open request's key date, colored by type. The current tab's dates are solid, the rest are softer. Click a day to see who.",
  },
  {
    date: "2026-11-04",
    kind: "Changed",
    title: "Status follows the checklist",
    body: "New requests show as Action Required until the first box is ticked, then Pending. The final step (Mark Active, Approve extension, Mark Completed) is still one click you confirm. The Needs info button is gone; to set a status by hand, use the dropdown in the profile panel.",
  },
  {
    date: "2026-11-04",
    kind: "New",
    title: "Scope and country of residence on cards",
    body: "Onboarding and Extension cards have a Show scope toggle. Onboarding cards show Country of residence (with the state for US) instead of working location.",
  },
  {
    date: "2026-11-02",
    kind: "New",
    title: "Roster",
    body: "Everyone in the SoT, one tab per Sheet status (Onboarding, Active, Ending soon, and so on). Flags anyone past their end date. Click a name for their profile.",
  },
  {
    date: "2026-11-02",
    kind: "New",
    title: "Change a status by hand",
    body: "If a box was ticked by mistake, fix the status from the dropdown in Roster or the profile panel. It asks before writing to the Sheet and says what else changes in the SoT.",
  },
  {
    date: "2026-11-02",
    kind: "Changed",
    title: "Shorter IT messages",
    body: "Copy message for IT now has just the name, date and systems, plus a blank for the new Speak email on setup.",
  },
  {
    date: "2026-10-28",
    kind: "New",
    title: "DocuSign ticks itself",
    body: "When everyone signs in DocuSign, \"Contract signed by all\", \"Amendment signed\" or \"New contract signed\" gets ticked automatically. These steps are tagged Automatic.",
  },
  {
    date: "2026-10-28",
    kind: "New",
    title: "Full form answers in the profile",
    body: "Click a name to see every answer they (or their manager) submitted, for all request types.",
  },
  {
    date: "2026-10-28",
    kind: "Changed",
    title: "Onboarding checklist, 6 steps",
    body: "Form received, DocuSign draft ready, Contract and onboarding email sent, Contract signed by all, Speak email and tools set up (if needed), Added to Deel or HRIS.",
  },
  {
    date: "2026-10-28",
    kind: "New",
    title: "Nightly SoT status sync",
    body: "Every weekday morning (8:50 KST), SoT statuses are checked against end dates and open requests, and fixed where they disagree.",
  },
  {
    date: "2026-10-27",
    kind: "New",
    title: "Open items",
    body: "Onboarding, Extension, Offboarding and Rate Change each get their own tab with a checklist per request. Includes Copy message for IT access removal and a list of contracts ending soon with nothing filed.",
  },
];

import type { RequestSource } from "./parsers";

// Statuses a person can pick by hand in /v2: exactly the Sheet's own
// dropdowns, same values and order (read from the Sheet's data validation
// 2026-11-10; the Sheet is strict, so anything else is rejected). Keep in
// step with the allowlist in app/api/contractors/status.
export const STATUS_OPTIONS: Record<RequestSource | "sot", string[]> = {
  onboarding: ["Action Required", "Pending", "Active", "Ended", "Void"],
  extension: ["Action Required", "Pending", "Active", "Void"],
  offboarding: ["Action Required", "Pending", "Completed", "Void"],
  rate_change: ["Action Required", "Pending", "Completed", "Void"],
  sot: ["Action Required", "Onboarding", "Active", "Ending soon", "Ended", "Voided"],
};

/** What else a request status change writes to the SoT row (see the status route). */
export function sotSideEffect(source: RequestSource, status: string): string {
  const s = status.toLowerCase();
  if (source === "onboarding" && s === "active") return "Their SoT status will also be set to Active.";
  if (source === "extension" && s === "active") return "Their SoT status will also be set to Active and the SoT end date to the new end date.";
  if (source === "offboarding" && s === "completed") return "Their SoT status will also be set to Ended, and the SoT end date may move earlier.";
  if (source === "offboarding" && s !== "void") return "Their SoT status will also be set to Ending soon.";
  return "";
}

/** What else an SoT status change does (see HubApp.setSotStatus). */
export function sotStatusSideEffect(status: string): string {
  const s = status.toLowerCase();
  if (s === "ended") return "Any open offboarding request with every step ticked will be marked Completed.";
  if (s === "onboarding") return "Their latest onboarding request will be reopened and show in Open items again.";
  if (s === "active") return "Any open onboarding or extension request will be marked Active (an extension also sets the SoT end date).";
  if (s === "ending soon") return "Their latest Completed offboarding request will be reopened and show in Open items again.";
  return "";
}

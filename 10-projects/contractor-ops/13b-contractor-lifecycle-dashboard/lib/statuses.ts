import type { RequestSource } from "./parsers";

// Statuses a person can pick by hand in /v2. Same values as the Sheet's own
// dropdowns (and the allowlist in app/api/contractors/status).
export const STATUS_OPTIONS: Record<RequestSource | "sot", string[]> = {
  onboarding: ["Pending", "Action Required", "Active", "Ended", "Void"],
  extension: ["Pending", "Action Required", "Active", "Void"],
  offboarding: ["Pending", "Action Required", "Completed", "Void"],
  rate_change: ["Pending", "Action Required", "Completed", "Void"],
  sot: ["Onboarding", "Active", "Pending", "Action Required", "Ending soon", "Ended", "Voided"],
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
  if (status.toLowerCase() === "ended")
    return "Any open offboarding request with every step ticked will be marked Completed.";
  return "";
}

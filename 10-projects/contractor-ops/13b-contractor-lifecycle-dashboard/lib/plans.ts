import type { RequestEntry, RequestSource } from "./parsers";
import { canonicalName } from "./owners";

/**
 * Action plan per request type, agreed with Shihyun 2026-10-27. Each type is
 * its own workflow; the final action is the existing status write (which
 * also drives the SoT auto-sync).
 *
 * `auto` labels a step an automation actually ticks today. Only tag a step
 * once its automation is live (planned: DocuSign draft via 13c, signed
 * steps via the DocuSign signed alert). `onlyIfChanged`
 * steps only apply to extensions where scope or rate changed (see
 * extensionChanged).
 */

export type PlanStep = {
  id: string;
  label: string;
  auto?: string;
  onlyIfChanged?: boolean;
};

export type Plan = {
  label: string;
  intro: string;
  steps: PlanStep[];
  final: { label: string; status: string };
};

export const PLANS: Record<RequestSource, Plan> = {
  onboarding: {
    label: "Onboarding",
    intro:
      "The form comes in and you create the DocuSign draft. Send the contract with the onboarding email, wait for all signatures, then set up the Speak email and tools if needed and finish the Deel (or other HRIS) setup. Mark Active when done; the SoT updates itself.",
    steps: [
      { id: "form", label: "Form received", auto: "Form" },
      { id: "draft", label: "DocuSign draft ready" },
      { id: "contract_sent", label: "Contract + onboarding email sent" },
      // Ticked by the DocuSign signed alert via /api/hooks/docusign-completed.
      { id: "signed", label: "Contract signed by all", auto: "Automatic" },
      { id: "setup", label: "Speak email & tools set up (if needed)" },
      { id: "hris", label: "Added to Deel / HRIS" },
    ],
    final: { label: "Mark Active", status: "Active" },
  },
  extension: {
    label: "Extension",
    intro:
      "Confirm nothing changed, update Deel, tell the contractor, then approve. If scope or rate changed, a DocuSign amendment comes first. Approving writes the new end date to the SoT.",
    steps: [
      { id: "confirm", label: "Scope & rate confirmed" },
      { id: "amend_sent", label: "Amendment sent (DocuSign)", onlyIfChanged: true },
      { id: "amend_signed", label: "Amendment signed", auto: "Automatic", onlyIfChanged: true },
      { id: "deel", label: "End date updated in Deel" },
      { id: "inform", label: "Contractor informed" },
    ],
    final: { label: "Approve extension", status: "Active" },
  },
  offboarding: {
    label: "Offboarding",
    intro:
      "Check the last day, tell the contractor, terminate on Deel and ask IT to remove access. Completing sets the SoT to Ended.",
    steps: [
      { id: "date", label: "Last day confirmed" },
      { id: "inform", label: "Contractor informed" },
      { id: "deel", label: "Terminated in Deel" },
      { id: "access", label: "Access removal requested (IT)" },
    ],
    final: { label: "Mark Completed", status: "Completed" },
  },
  rate_change: {
    label: "Rate Change",
    intro:
      "A new contract goes out by DocuSign, then the rate is updated on Deel and the contractor is told. No SoT change.",
    steps: [
      { id: "contract_sent", label: "New contract sent (DocuSign)" },
      { id: "contract_signed", label: "New contract signed", auto: "Automatic" },
      { id: "deel", label: "Rate updated in Deel" },
      { id: "inform", label: "Contractor informed" },
    ],
    final: { label: "Mark Completed", status: "Completed" },
  },
};

export const REQUEST_TYPES: RequestSource[] = [
  "onboarding",
  "extension",
  "offboarding",
  "rate_change",
];

/**
 * The extension form's "Has the scope of work and/or payment rate changed?"
 * is free text ("No", "same!", "Yes, rate now 4,000 JPY/hr", or a paragraph
 * describing the new scope). Only clear answers are read automatically;
 * everything else needs a human call, saved as the "changed" choice.
 */
export type ChangeAnswer = "no" | "yes" | "unclear";

export function readChangeAnswer(r: RequestEntry): ChangeAnswer {
  const a = (r.scopeOrRateChanged || "").trim().toLowerCase();
  if (/^yes\b/.test(a)) return "yes";
  if (/^(no\b|no[.!,]|same\b|same!|no change|unchanged)/.test(a)) return "no";
  if (/same scope/.test(a) && /same (pay|rate)|payment rate is the same|no change payment/.test(a)) return "no";
  return "unclear";
}

/** Step id that stores a human's Unchanged / Changed call for an extension. */
export const CHANGED_CHOICE = "changed";

/**
 * Whether this extension takes the DocuSign path. A saved choice wins over
 * the form answer; null means nobody has decided yet (form answer unclear).
 */
export function extensionChanged(
  r: RequestEntry,
  saved?: Record<string, boolean>,
): boolean | null {
  if (saved && CHANGED_CHOICE in saved) return saved[CHANGED_CHOICE];
  const a = readChangeAnswer(r);
  return a === "unclear" ? null : a === "yes";
}

/** The steps that apply to this request (extension branch resolved; undecided = short path). */
export function stepsFor(r: RequestEntry, saved?: Record<string, boolean>): PlanStep[] {
  const changed = r.source === "extension" && extensionChanged(r, saved) === true;
  return PLANS[r.source].steps.filter((s) => !s.onlyIfChanged || changed);
}

/**
 * Stable request ID: type + canonical name + form submission date. Survives
 * rows moving in the Sheet (rowIndex doesn't). Every request had a
 * requestedAt when checked on 2026-10-27; rowIndex is a last-resort fallback.
 */
export function requestKey(r: RequestEntry): string {
  const when = r.requestedAt || `row${r.rowIndex}`;
  return `${r.source}:${canonicalName(r.name)}:${when}`;
}

import { NextResponse } from "next/server";
import { loadAll, type RequestEntry } from "@/lib/parsers";
import { canonicalName } from "@/lib/owners";
import { requestKey } from "@/lib/plans";
import { readSteps, writeStep } from "@/lib/steps";
import { appendLog } from "@/lib/activityLog";

export const dynamic = "force-dynamic";

/**
 * Called by the docusign-completed-alert bot (peopleops-automations) after it
 * posts a fully signed envelope to Slack. Ticks the "signed" step on the
 * matching open request and records it in the automation log.
 *
 * Auth: `Authorization: Bearer ${DOCUSIGN_HOOK_SECRET}` (shared with the bot).
 * Public in middleware because the bot has no session.
 *
 * Matching: a signer's email = the contractor's email from their onboarding
 * form; falls back to signer name = contractor name. Speak-side signers
 * (finance etc.) simply don't match anything.
 */

// Which step a completed envelope ticks, per request type.
const SIGNED_STEP: Partial<Record<RequestEntry["source"], string>> = {
  onboarding: "signed",
  rate_change: "contract_signed",
  extension: "amend_signed",
};

type Body = {
  envelopeId?: string;
  subject?: string;
  completedAt?: string;
  signers?: { name?: string; email?: string }[];
};

export async function POST(req: Request) {
  const expected = process.env.DOCUSIGN_HOOK_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const signers = (body.signers || []).filter((s) => s.name || s.email);
  const signerEmails = new Set(signers.map((s) => (s.email || "").trim().toLowerCase()).filter(Boolean));
  const signerNames = new Set(signers.map((s) => canonicalName(s.name)).filter(Boolean));
  const doc = body.subject || "(no subject)";

  try {
    const [data, steps] = await Promise.all([loadAll(), readSteps()]);
    // Contractor email lives on their onboarding row.
    const emailByName = new Map<string, string>();
    for (const o of data.onboarding) {
      if (o.email) emailByName.set(canonicalName(o.name), o.email.trim().toLowerCase());
    }
    const open = [...data.onboarding, ...data.rateChange, ...data.extension].filter((r) => !r.closed);
    const matches = open.filter((r) => {
      const email = emailByName.get(canonicalName(r.name));
      return (email && signerEmails.has(email)) || signerNames.has(canonicalName(r.name));
    });

    const ticked: string[] = [];
    for (const r of matches) {
      const step = SIGNED_STEP[r.source];
      if (!step) continue;
      const key = requestKey(r);
      if (steps[key]?.[step] === true) continue; // already ticked
      await writeStep({ key, type: r.source, contractor: r.name, step, done: true, by: "DocuSign (auto)" });
      ticked.push(`${r.name} (${r.requestType})`);
    }

    await appendLog(
      ticked.length
        ? matches
            .filter((r) => SIGNED_STEP[r.source])
            .map((r) => ({
              automation: "DocuSign signed alert",
              flow: "Contractor",
              trigger: "DocuSign",
              person: r.name,
              action: `${r.requestType}: contract fully signed, step ticked`,
              result: "OK" as const,
              details: doc,
            }))
        : [
            {
              automation: "DocuSign signed alert",
              flow: "Contractor",
              trigger: "DocuSign",
              person: "",
              action: matches.length ? "Signed envelope already ticked" : "Signed envelope, no matching open request",
              result: "Skipped" as const,
              details: `${doc} · signers: ${signers.map((s) => s.name || s.email).join(", ")}`,
            },
          ],
    );
    return NextResponse.json({ ok: true, ticked });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog([
      { automation: "DocuSign signed alert", flow: "Contractor", trigger: "DocuSign", person: "", action: "Auto-tick failed", result: "Failed", details: `${doc}: ${message}` },
    ]);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

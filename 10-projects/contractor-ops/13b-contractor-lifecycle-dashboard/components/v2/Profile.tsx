"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData, RequestEntry, RequestSource, SotEntry } from "@/lib/parsers";
import type { StepState } from "@/lib/steps";
import type { Submission } from "@/lib/submissions";
import { canonicalName, formatCountry } from "@/lib/owners";
import { parseDate, workingDaysUntil } from "@/lib/dates";
import { PLANS, requestKey, stepsFor } from "@/lib/plans";
import { STATUS_OPTIONS, sotSideEffect, sotStatusSideEffect } from "@/lib/statuses";
import StatusSelect from "./StatusSelect";

// Contractor profile: SoT contract facts + every answer from every form
// they've submitted (from "Form Responses", all four request types),
// newest first. Status and checklist progress come from the request tabs.

function fmt(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—";
}

// Fallback summary from the request tabs, used if Form Responses can't load.
function summary(r: RequestEntry): [string, string][] {
  const rows: [string, string | null | undefined][] =
    r.source === "onboarding"
      ? [["Email", r.email], ["Role", [r.jobTitle, r.department].filter(Boolean).join(", ")], ["Contract", `${fmt(r.startDate)} → ${fmt(r.endDate)}`], ["Payment", [r.paymentRate, r.paymentType].filter(Boolean).join(", ")], ["Scope of work", r.scopeOfWork], ["Tools", r.saasTools]]
      : r.source === "extension"
        ? [["New end date", fmt(r.newEndDate)], ["Scope / rate changed", r.scopeOrRateChanged]]
        : r.source === "offboarding"
          ? [["Last day", fmt(r.endDate)], ["Reason", r.terminationReason], ["Contractor notified", r.notifiedFlag]]
          : [["New rate", r.newPaymentRate], ["Effective", fmt(r.effectiveDate)]];
  return rows.filter((x): x is [string, string] => !!x[1] && x[1].trim() !== "—");
}

export default function Profile({
  name,
  data,
  steps,
  statusOf,
  isOpen,
  sotStatusOf,
  onStatus,
  onSotStatus,
  onReopen,
  onClose,
}: {
  name: string;
  data: DashboardData;
  steps: StepState;
  statusOf: (r: RequestEntry) => string;
  isOpen: (r: RequestEntry) => boolean;
  sotStatusOf: (p: SotEntry) => string;
  onStatus: (r: RequestEntry, status: string) => Promise<boolean>;
  onSotStatus: (p: SotEntry, status: string) => Promise<boolean>;
  onReopen: (r: RequestEntry) => Promise<void>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [subsError, setSubsError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setSubs(null);
    setSubsError(null);
    fetch(`/api/profile?name=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!cancelled) setSubs(body.submissions);
      })
      .catch((err) => !cancelled && setSubsError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [name]);

  const key = canonicalName(name);
  const sot = data.sot.find((s) => canonicalName(s.name) === key);
  const reqs = [...data.onboarding, ...data.extension, ...data.offboarding, ...data.rateChange]
    .filter((r) => canonicalName(r.name) === key)
    .sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
  const onb = reqs.find((r) => r.source === "onboarding");
  const country = sot?.country || reqs[0]?.country || "";
  const role = [sot?.jobTitle || onb?.jobTitle, sot?.department || onb?.department].filter(Boolean).join(", ");
  const end = parseDate(sot?.endDate);
  const left = end ? workingDaysUntil(end) : null;

  // Roster and request disagree (Shihyun, 2026-11-10): Roster says Onboarding
  // but their latest onboarding is closed, or Ending soon but their latest
  // offboarding is Completed. Offer a one-click reopen.
  const sotNow = sot ? sotStatusOf(sot).trim().toLowerCase() : "";
  const latestOf = (t: RequestSource) => reqs.find((r) => r.source === t);
  const mismatch: { r: RequestEntry; msg: string } | null = (() => {
    const onbLatest = latestOf("onboarding");
    if (sotNow === "onboarding" && onbLatest && !reqs.some((r) => r.source === "onboarding" && isOpen(r)) && ["active", "ended"].includes(statusOf(onbLatest).trim().toLowerCase()))
      return { r: onbLatest, msg: `Roster says Onboarding, but their onboarding request is ${statusOf(onbLatest)}.` };
    const offLatest = latestOf("offboarding");
    if (sotNow === "ending soon" && offLatest && !reqs.some((r) => r.source === "offboarding" && isOpen(r)) && statusOf(offLatest).trim().toLowerCase() === "completed")
      return { r: offLatest, msg: "Roster says Ending soon, but their offboarding request is Completed." };
    return null;
  })();
  const [reopening, setReopening] = useState(false);

  // The request-tab row for a submission: same type + same submission date.
  const requestFor = (type: RequestSource | null, at: string | null) =>
    reqs.find((r) => r.source === type && r.requestedAt === at);

  function head(type: RequestSource | null, typeLabel: string, at: string | null, r?: RequestEntry) {
    const list = r ? stepsFor(r, steps[requestKey(r)] || {}) : [];
    const done = r ? list.filter((s) => s.id === "form" || steps[requestKey(r)]?.[s.id]).length : 0;
    return (
      <div className="who">
        <span className="pill type">{type ? PLANS[type].label : typeLabel || "Request"}</span>
        {r && (
          <StatusSelect
            value={statusOf(r)}
            options={STATUS_OPTIONS[r.source]}
            what={`this ${PLANS[r.source].label.toLowerCase()} request`}
            note={(next) => sotSideEffect(r.source, next)}
            onChange={(next) => onStatus(r, next)}
          />
        )}
        <span className="due">submitted {fmt(at)}</span>
        {r && isOpen(r) && <span className="steps">{done} of {list.length} steps</span>}
        {r && r.source === "offboarding" && isOpen(r) && sot && sotStatusOf(sot).trim().toLowerCase() === "ended" && (
          <span className="hint">Roster says Ended. Finish the steps or mark Completed.</span>
        )}
      </div>
    );
  }

  // Question above answer: form questions are often a full sentence long.
  const fieldList = (fields: [string, string][]) => (
    <dl className="fields">
      {fields.map(([k, v], i) => (
        <div key={`${k}-${i}`} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${name} profile`}>
        <div className="dhead">
          <button ref={closeRef} type="button" className="x" onClick={onClose} aria-label="Close">×</button>
          <h2 className="dname">{name}</h2>
          {role && <span className="sub">{role}</span>}
          <div className="who">
            {sot && (
              <>
                <span className="sub" style={{ fontSize: 12 }}>SoT status</span>
                <StatusSelect value={sotStatusOf(sot)} options={STATUS_OPTIONS.sot} what={`${sot.name}'s SoT status`} note={sotStatusSideEffect} onChange={(next) => onSotStatus(sot, next)} />
              </>
            )}
            <span className="sub" style={{ fontSize: 12 }}>{formatCountry(country) || "Country unknown"}</span>
          </div>
        </div>
        <div className="dbody">
          {mismatch && (
            <div className="mismatch" role="status">
              <span>{mismatch.msg}</span>
              <button
                type="button"
                className="btn"
                disabled={reopening}
                onClick={async () => {
                  setReopening(true);
                  await onReopen(mismatch.r);
                  setReopening(false);
                }}
              >
                {reopening ? "Reopening…" : "Reopen request"}
              </button>
            </div>
          )}
          <details className="contract" open>
            <summary className="label">Contract (SoT)</summary>
            {sot ? (
              <>
                <div className="row"><span>Start</span><span className="mono">{fmt(sot.startDate)}</span></div>
                <div className="row"><span>End</span><span className="mono">{fmt(sot.endDate)}</span></div>
                {left !== null && (
                  <div className="row"><span>Time left</span><span className={`due ${left <= 10 ? "urgent" : ""}`}>{left < 0 ? `${-left}d past end` : `${left} working days`}</span></div>
                )}
                <div className="row"><span>Manager</span><span>{sot.manager || "—"}</span></div>
                <div className="row"><span>Approver</span><span>{sot.approver || "—"}</span></div>
              </>
            ) : (
              <span className="sub">Not in the SoT tab yet.</span>
            )}
          </details>

          <section>
            <div className="label" style={{ marginBottom: 10 }}>
              Submitted forms: {subs ? subs.length : reqs.length}
            </div>
            <div className="reqlist">
              {subs
                ? subs.map((s, i) => {
                    const r = requestFor(s.type, s.submittedAt);
                    return (
                      <details key={i} className={`preq t-${s.type || "onboarding"}`} open={i === 0}>
                        <summary>{head(s.type, s.typeLabel, s.submittedAt, r)}</summary>
                        {fieldList(s.fields)}
                      </details>
                    );
                  })
                : reqs.map((r, i) => (
                    <details key={requestKey(r)} className={`preq t-${r.source}`} open={i === 0}>
                      <summary>{head(r.source, r.requestType, r.requestedAt ?? null, r)}</summary>
                      {fieldList(summary(r))}
                    </details>
                  ))}
              {!subs && !subsError && <p className="sub" style={{ fontSize: 12 }}>Loading every submitted answer…</p>}
              {subsError && <p className="sub" style={{ fontSize: 12 }}>Showing a summary; full answers couldn&apos;t load ({subsError}).</p>}
              {subs && !subs.length && <p className="sub">No form submissions found for this name.</p>}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

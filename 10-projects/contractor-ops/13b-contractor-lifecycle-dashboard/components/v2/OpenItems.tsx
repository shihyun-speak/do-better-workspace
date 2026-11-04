"use client";

import { useState } from "react";
import type { DashboardData, RequestEntry, RequestSource, SotEntry } from "@/lib/parsers";
import type { StepState } from "@/lib/steps";
import { canonicalName, formatCountry } from "@/lib/owners";
import { parseDate, workingDaysUntil } from "@/lib/dates";
import { inRegion, type Region } from "@/lib/regions";
import DateCalendar, { type CalEvent } from "./DateCalendar";
import {
  CHANGED_CHOICE,
  PLANS,
  REQUEST_TYPES,
  extensionChanged,
  readChangeAnswer,
  requestKey,
  stepsFor,
  type PlanStep,
} from "@/lib/plans";

// Open items: one tab per request type (they are separate workflows), each
// grouped by its own stages. Stage = last step finished; Action Required
// requests sit on top; "Ready" means every step is ticked.

const ROWS: Record<RequestSource, (d: DashboardData) => RequestEntry[]> = {
  onboarding: (d) => d.onboarding,
  extension: (d) => d.extension,
  offboarding: (d) => d.offboarding,
  rate_change: (d) => d.rateChange,
};

// The date each type cares about, for the side column.
const KEY_DATE: Record<RequestSource, [string, (r: RequestEntry) => string | null]> = {
  onboarding: ["Start dates", (r) => r.startDate],
  extension: ["Current end dates", (r) => r.priorEndDate || r.endDate],
  offboarding: ["Last days", (r) => r.endDate],
  rate_change: ["Effective dates", (r) => r.effectiveDate],
};

function fmt(iso: string | null | undefined, year = false): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
}

export function OwnerPill({ owner, country }: { owner: string; country: string }) {
  const c = formatCountry(country);
  const tag = owner === "apac" ? "APAC" : owner === "row" ? (c.startsWith("US") ? "US" : "RoW") : "?";
  const cls = tag === "APAC" ? "o-apac" : tag === "US" ? "o-us" : tag === "RoW" ? "o-row" : "o-unknown";
  return <span className={`pill owner ${cls}`} title={c || "Country unknown"}>{tag}</span>;
}

// Calendar days from today (UTC dates) to a date; negative = in the past.
function daysFromToday(d: Date): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today) / 86400000);
}

// D-day next to the name (Shihyun, 2026-11-04): days to each type's key date.
const DDAY_NOUN: Record<RequestSource, string> = {
  onboarding: "start",
  extension: "end date",
  offboarding: "last day",
  rate_change: "rate change",
};

function DDay({ r }: { r: RequestEntry }) {
  const d = parseDate(KEY_DATE[r.source][1](r));
  if (!d) return null;
  const n = daysFromToday(d);
  const noun = DDAY_NOUN[r.source];
  const text = n > 0 ? `D-${n} to ${noun}` : n === 0 ? `${noun[0].toUpperCase()}${noun.slice(1)} is today` : `${noun[0].toUpperCase()}${noun.slice(1)} was ${-n} day${n === -1 ? "" : "s"} ago`;
  const cls = n < 0 ? "dday past" : n <= 3 ? "dday soon" : "dday";
  return <span className={cls} title={fmt(d.toISOString().slice(0, 10), true)}>{text}</span>;
}

function fieldsFor(r: RequestEntry): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string, v: string | null | undefined) => {
    if (v && v.trim() && v.trim().toUpperCase() !== "N/A") out.push([k, v.trim()]);
  };
  if (r.source === "onboarding") {
    add("Role", [r.jobTitle, r.department].filter(Boolean).join(", "));
    add("Start", fmt(r.startDate, true));
    add("Rate", r.paymentRate);
    add("Scope", r.scopeOfWork);
    // Hemmi (2026-11-04): country of residence, with state for US ("US, California").
    add("Country of residence", formatCountry(r.country));
    add("Tools", r.saasTools);
  } else if (r.source === "extension") {
    add("End date", `${fmt(r.priorEndDate, true)} → ${fmt(r.newEndDate, true)}`);
    add("Scope", r.scopeOfWork);
  } else if (r.source === "offboarding") {
    add("Last day", fmt(r.endDate, true));
    add("Reason", r.terminationReason);
    add("Contractor notified", r.notifiedFlag);
  } else {
    add("New rate", r.newPaymentRate);
    add("Effective", fmt(r.effectiveDate, true));
  }
  add("Manager", r.manager);
  return out;
}

export default function OpenItems({
  data,
  region,
  steps,
  statusOf,
  isOpen,
  onStep,
  onStatus,
  flash,
  onOpen,
}: {
  data: DashboardData;
  region: Region;
  steps: StepState;
  statusOf: (r: RequestEntry) => string;
  isOpen: (r: RequestEntry) => boolean;
  onStep: (r: RequestEntry, step: string, done: boolean) => void;
  onStatus: (r: RequestEntry, status: string) => Promise<boolean>;
  flash: (msg: string, err?: boolean) => void;
  onOpen: (name: string) => void;
}) {
  const NameBtn = ({ name }: { name: string }) => (
    <button type="button" className="namebtn" onClick={() => onOpen(name)}>{name}</button>
  );
  const openOf = (t: RequestSource) => ROWS[t](data).filter((r) => isOpen(r) && inRegion(r.owner, region));
  // Always opens on Onboarding (Shihyun, 2026-10-28), even when it has no open items.
  const [tab, setTab] = useState<RequestSource>("onboarding");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAllUndecided, setShowAllUndecided] = useState(false);

  const plan = PLANS[tab];
  const saved = (r: RequestEntry) => steps[requestKey(r)] || {};
  // "Form submitted" is done by definition: the request row exists.
  const isDone = (r: RequestEntry, s: PlanStep) => s.id === "form" || saved(r)[s.id] === true;
  const nextIdx = (r: RequestEntry) => stepsFor(r, saved(r)).findIndex((s) => !isDone(r, s));
  const stageOf = (r: RequestEntry) => {
    const list = stepsFor(r, saved(r));
    const nx = nextIdx(r);
    return nx === -1 ? "ready" : nx === 0 ? "new" : list[nx - 1].id;
  };

  const list = openOf(tab).sort((a, b) => (a.requestedAt || "").localeCompare(b.requestedAt || ""));
  const stages: [string, string][] = [
    // Status follows the ticks (HubApp.syncStatus): nothing ticked = Action Required.
    ["new", "Not started (Action Required)"],
    ...plan.steps.map((s) => [s.id, s.label] as [string, string]),
    ["ready", `Ready: ${plan.final.label}`],
  ];
  const grouped = stages.map(([k, l]) => [k, l, list.filter((r) => stageOf(r) === k)] as const);

  async function act(r: RequestEntry, status: string) {
    const key = requestKey(r);
    setBusy(key);
    await onStatus(r, status);
    setBusy(null);
    setConfirming(null);
  }

  function card(r: RequestEntry) {
    const key = requestKey(r);
    const s = saved(r);
    const list = stepsFor(r, s);
    const nx = nextIdx(r);
    const status = statusOf(r);
    const reqDate = parseDate(r.requestedAt);
    const waited = reqDate ? -workingDaysUntil(reqDate) : null;
    const ago = reqDate ? -daysFromToday(reqDate) : null;
    const changed = r.source === "extension" ? extensionChanged(r, s) : false;
    const auto = r.source === "extension" && !(CHANGED_CHOICE in s);
    const finalReady = nx === -1 && changed !== null;
    return (
      <article key={key} className={`rcard t-${r.source}`}>
        <div className="left">
          <div className="who">
            <NameBtn name={r.name} />
            <OwnerPill owner={r.owner} country={r.country} />
            <DDay r={r} />
            {ago !== null && (
              <span className={`due ${waited !== null && waited > 3 ? "urgent" : ""}`} title={`Form submitted ${fmt(r.requestedAt, true)}`}>
                {ago <= 0 ? "Requested today" : `Requested ${ago} day${ago === 1 ? "" : "s"} ago`}
              </span>
            )}
          </div>
          <dl className="kv">
            {fieldsFor(r).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                {k === "Scope" || k === "Tools" ? (
                  <dd>
                    <details className="reveal">
                      <summary>Show {k.toLowerCase()}</summary>
                      <p>{v}</p>
                    </details>
                  </dd>
                ) : (
                  <dd>{v}</dd>
                )}
              </div>
            ))}
          </dl>
          {r.source === "extension" && (
            <div className="choice">
              <span>
                Form: <q>{(r.scopeOrRateChanged || "No answer").slice(0, 160)}</q>
              </span>
              {changed === null ? (
                <span>Did scope or rate change?</span>
              ) : (
                <span className="sub" style={{ fontSize: 12 }}>
                  Path: {changed ? "changed, DocuSign amendment" : "no change"} {auto ? `(read from the form: ${readChangeAnswer(r)})` : "(set by you)"}
                </span>
              )}
              <div className="planfoot" style={{ marginTop: 0 }}>
                <button type="button" className="btn" aria-pressed={changed === false} onClick={() => onStep(r, CHANGED_CHOICE, false)}>
                  Unchanged
                </button>
                <button type="button" className="btn" aria-pressed={changed === true} onClick={() => onStep(r, CHANGED_CHOICE, true)}>
                  Changed
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="planside">
          <div className="label" style={{ marginBottom: 6 }}>
            Action plan: <span className="steps">{list.filter((x) => isDone(r, x)).length} of {list.length} steps</span>
          </div>
          <ul className="plan">
            {list.map((st, i) => {
              const done = isDone(r, st);
              return (
                <li key={st.id} className={done ? "done" : i === nx ? "next" : ""}>
                  <button type="button" aria-pressed={done} disabled={st.id === "form"} onClick={() => onStep(r, st.id, !done)}>
                    <span className="box">{done ? "✓" : ""}</span>
                    <span className="lbl">{st.label}</span>
                    {st.auto && <span className="auto">{st.auto}</span>}
                  </button>
                  {COPY_FOR[`${r.source}:${st.id}`] && (
                    <button
                      type="button"
                      className="btn ghost copy"
                      onClick={() => {
                        const [what, build] = COPY_FOR[`${r.source}:${st.id}`];
                        copy(build(r), what);
                      }}
                    >
                      Copy message
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="planfoot">
            {nx !== -1 ? (
              <button type="button" className="btn trigger" onClick={() => onStep(r, list[nx].id, true)}>
                Done: {list[nx].label}
              </button>
            ) : confirming === key ? (
              <>
                <button type="button" className="btn trigger" disabled={busy === key} onClick={() => act(r, plan.final.status)}>
                  {busy === key ? "Updating the Sheet…" : `Confirm: ${plan.final.label}`}
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirming(null)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="btn trigger" disabled={!finalReady} title={finalReady ? "" : "Decide whether scope or rate changed first"} onClick={() => setConfirming(key)}>
                {plan.final.label}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  // Contracts ending within 10 working days with no extension or offboarding
  // filed: the call is extend or offboard. Shown at the top of Open items on
  // every tab (Shihyun, 2026-11-04), hidden when there are none.
  const filed = new Set(
    [...data.extension, ...data.offboarding].filter((r) => isOpen(r)).map((r) => canonicalName(r.name)),
  );
  const undecided: SotEntry[] = data.sot
    .filter((p) => p.lifecycle === "ending_soon" && inRegion(p.owner, region) && !filed.has(canonicalName(p.name)))
    .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));

  // Tools requested on the onboarding form; offboarding rows don't carry
  // them, so removal looks up the contractor's latest onboarding row.
  function toolsText(tools?: string): string {
    return tools && tools.toUpperCase() !== "N/A" ? tools : "none listed on the form";
  }

  // Draft for the "Request access removal (IT)" step.
  function accessMessage(r: RequestEntry): string {
    const onb = data.onboarding.filter((o) => canonicalName(o.name) === canonicalName(r.name));
    const tools = onb.length ? onb[onb.length - 1].saasTools : undefined;
    return `Hi IT team, please remove access for this contractor on their last day:\n- Name: ${r.name}\n- Last day: ${fmt(r.endDate, true)}\n- Systems: ${toolsText(tools)}\nThanks!`;
  }

  // Draft for the onboarding "Speak email & tools set up" step.
  function setupMessage(r: RequestEntry): string {
    return `Hi IT team, please set up a Speak email and tool access for this new contractor:\n- Name: ${r.name}\n- New Speak email: [ ]@usespeak.com\n- Start date: ${fmt(r.startDate, true)}\n- Systems: ${toolsText(r.saasTools)}\nThanks!`;
  }

  // Steps that come with a ready-to-paste IT request.
  const COPY_FOR: Record<string, [string, (r: RequestEntry) => string]> = {
    "offboarding:access": ["IT request", accessMessage],
    "onboarding:setup": ["IT request", setupMessage],
  };

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(`${what} copied. Paste it where you send it.`);
    } catch {
      flash("Couldn't copy automatically. Message: " + text, true);
    }
  }

  async function askManager(p: SotEntry) {
    const msg = `Hi ${p.manager || "there"}, ${p.name}'s contract ends on ${fmt(p.endDate, true)}. Should we extend it or offboard? If extending, please submit the extension form; if not, the offboarding form. Thanks!`;
    try {
      await navigator.clipboard.writeText(msg);
      flash(`Message for ${p.manager || "the manager"} copied. Paste it in Slack.`);
    } catch {
      flash("Couldn't copy automatically. Message: " + msg, true);
    }
  }

  // Every open request's key date, all four types, for the shared calendar.
  const reqEvents: CalEvent[] = REQUEST_TYPES.flatMap((t) =>
    openOf(t).flatMap((r) => {
      const d = parseDate(KEY_DATE[t][1](r));
      return d ? [{ key: requestKey(r), kind: t, date: d, who: r }] : [];
    }),
  );
  // Plus the contract end of everyone still active in SoT (not Ended / Void),
  // unless an open extension or offboarding already puts them on the calendar.
  const INACTIVE = new Set(["ended", "void", "voided"]);
  const sotEvents: CalEvent[] = data.sot
    .filter((p) => !INACTIVE.has((p.rawStatus || "").trim().toLowerCase()) && inRegion(p.owner, region) && !filed.has(canonicalName(p.name)))
    .flatMap((p) => {
      const d = parseDate(p.endDate);
      return d ? [{ key: `sot:${p.rowIndex}`, kind: "contract" as const, date: d, who: p }] : [];
    });
  const calEvents = [...reqEvents, ...sotEvents];
  const regionLabel = region === "all" ? "All regions" : region === "apac" ? "APAC" : "US + RoW";

  return (
    <>
      <div className="pagehead">
        <h1>Open items</h1>
        <p className="sub">{regionLabel}</p>
      </div>
      <div className="typetabs" role="tablist">
        {REQUEST_TYPES.map((t) => (
          <button key={t} type="button" role="tab" className={`t-${t}`} aria-selected={tab === t} onClick={() => { setTab(t); setConfirming(null); }}>
            {PLANS[t].label}
            <span className="num">{openOf(t).length}</span>
          </button>
        ))}
      </div>
      <div className={`t-${tab}`}>
        <p className="planintro">
          <b>How it works</b>
          {plan.intro}
        </p>
        <div className="flow">
          {grouped
            .filter(([k]) => k !== "new")
            .map(([k, l, rs], i) => (
              <span key={k} style={{ display: "contents" }}>
                {i > 0 && <i>→</i>}
                <span className={rs.length ? "has" : ""}>
                  {l} <b className="num">{rs.length}</b>
                </span>
              </span>
            ))}
        </div>
      </div>
      <div className="layout">
        <div className="stack">
          {list.length ? (
            grouped
              .filter(([, , rs]) => rs.length)
              .map(([k, l, rs]) => (
                <section key={k} className="group">
                  <div className="grouphead">
                    <h2>{l}</h2>
                    <span className="num">{rs.length}</span>
                  </div>
                  {rs.map(card)}
                </section>
              ))
          ) : (
            <p className="panel empty">No open {plan.label.toLowerCase()} requests in {regionLabel}.</p>
          )}
        </div>
        <div className="stack">
          {undecided.length > 0 && (
            <section className="panel undecided">
              <div className="panelhead">
                <h2>Ending soon, nothing filed <span className="num">{undecided.length}</span></h2>
              </div>
              <ul className="ulist">
                {(showAllUndecided ? undecided : undecided.slice(0, 3)).map((p) => {
                  const d = parseDate(p.endDate);
                  const n = d ? daysFromToday(d) : null;
                  return (
                    <li key={p.rowIndex} title={`Ends ${fmt(p.endDate, true)}, manager ${p.manager || "unknown"}`}>
                      <NameBtn name={p.name} />
                      {n !== null && (
                        <span className={n < 0 ? "dday past" : n <= 3 ? "dday soon" : "dday"}>
                          {n > 0 ? `D-${n}` : n === 0 ? "Today" : `Ended ${-n}d ago`}
                        </span>
                      )}
                      <button type="button" className="btn ask" onClick={() => askManager(p)} title={`Copy a message for ${p.manager || "the manager"}: extend or offboard?`}>
                        Ask manager
                      </button>
                    </li>
                  );
                })}
              </ul>
              {undecided.length > 3 && (
                <button type="button" className="linkbtn umore" onClick={() => setShowAllUndecided((v) => !v)}>
                  {showAllUndecided ? "Show less" : `+${undecided.length - 3} more`}
                </button>
              )}
            </section>
          )}
          <DateCalendar
            events={calEvents}
            tab={tab}
            renderWho={(w) => (
              <>
                <NameBtn name={w.name} />
                <OwnerPill owner={w.owner} country={w.country} />
              </>
            )}
          />
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData, RequestEntry, SotEntry } from "@/lib/parsers";
import { isClosedStatus } from "@/lib/parsers";
import type { StepState } from "@/lib/steps";
import { REGIONS, inRegion, type Region } from "@/lib/regions";
import { CHANGED_CHOICE, requestKey, stepsFor } from "@/lib/plans";
import { canonicalName } from "@/lib/owners";
import OpenItems from "./OpenItems";
import Profile from "./Profile";
import Roster from "./Roster";
import Updates from "./Updates";
import { UPDATES } from "@/lib/updates";

// Redesign shell: nav, region switcher, toasts, and the write calls (step
// ticks + status changes) shared by every view.

type View = "open" | "roster" | "updates";

export default function HubApp({
  data: initialData,
  initialSteps,
  stepsError,
  defaultRegion,
  viewerEmail,
}: {
  data: DashboardData;
  initialSteps: StepState;
  stepsError: string | null;
  defaultRegion: Region;
  viewerEmail: string;
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [view, setView] = useState<View>("open");
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [profile, setProfile] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState>(initialSteps);
  // requestKey → status written this session (optimistic, until next load).
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  // SoT row → status written this session (directly or as a side-effect).
  const [sotOverrides, setSotOverrides] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(
    stepsError ? { msg: `Checklist ticks couldn't load: ${stepsError}`, err: true } : null,
  );

  function flash(msg: string, err = false) {
    setToast({ msg, err });
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(null), err ? 8000 : 4000);
  }

  // Live updates (Shihyun, 2026-11-10): re-read the Sheet every 30s while the
  // tab is visible, and right away when you come back to it, so edits made
  // directly in the Sheet show up without a reload. A read that overlaps one
  // of our own writes is thrown away (it may predate the write); the next
  // one catches up. Once a read lands after every write, the Sheet is the
  // truth again, so the optimistic overrides are cleared.
  const writes = useRef({ inFlight: 0, last: 0 });
  async function tracked<T>(fn: () => Promise<T>): Promise<T> {
    writes.current.inFlight++;
    try {
      return await fn();
    } finally {
      writes.current.inFlight--;
      writes.current.last = Date.now();
    }
  }
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const polling = useRef(false);
  async function poll(manual = false) {
    if (polling.current) return;
    polling.current = true;
    if (manual) setRefreshing(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/hub", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (writes.current.inFlight || writes.current.last >= started) return;
      setData(body.data);
      setSteps(body.steps);
      setStatusOverrides({});
      setSotOverrides({});
      setSyncedAt(new Date());
      setSyncFailed(false);
      void matchRef.current(body.data, body.steps);
    } catch (err) {
      setSyncFailed(true);
      if (manual) flash(`Couldn't refresh from the Sheet: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      polling.current = false;
      if (manual) setRefreshing(false);
    }
  }
  const pollRef = useRef(poll);
  pollRef.current = poll;
  useEffect(() => {
    setSyncedAt(new Date());
    const tick = () => document.visibilityState === "visible" && pollRef.current();
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const all = [...data.onboarding, ...data.extension, ...data.offboarding, ...data.rateChange];
  const statusOf = (r: RequestEntry) => statusOverrides[requestKey(r)] ?? r.status;
  const sotStatusOf = (p: SotEntry) => sotOverrides[p.rowIndex] ?? p.rawStatus;
  const isOpen = (r: RequestEntry) => {
    const o = statusOverrides[requestKey(r)];
    return o ? !isClosedStatus(r.source, o) : !r.closed;
  };

  // Request status follows the checklist (Shihyun, 2026-11-04): nothing ticked
  // beyond "Form received" = Action Required, anything ticked = Pending. The
  // final status (Active / Completed) stays a separate confirm click because
  // it writes to the SoT.
  function wantedStatus(r: RequestEntry, saved: Record<string, boolean> = {}): string {
    const ticked = stepsFor(r, saved).some((s) => s.id !== "form" && saved[s.id] === true);
    return ticked ? "Pending" : "Action Required";
  }
  const needsSync = (r: RequestEntry, saved?: Record<string, boolean>) =>
    isOpen(r) && statusOf(r).trim().toLowerCase() !== wantedStatus(r, saved).toLowerCase();

  // Roster Ended closes the offboarding (Shihyun, 2026-11-09): when the SoT
  // status is Ended, an open Offboarding request whose checklist is fully
  // ticked flips to Completed. If steps are missing it stays open and the
  // profile says so, so unfinished steps (access removal etc.) stay visible.
  const allStepsDone = (r: RequestEntry, saved: Record<string, boolean> = {}) =>
    stepsFor(r, saved).every((s) => s.id === "form" || saved[s.id] === true);
  const sotEndedFor = (name: string) => {
    const p = data.sot.find((x) => canonicalName(x.name) === canonicalName(name));
    return !!p && sotStatusOf(p).trim().toLowerCase() === "ended";
  };
  const openOffboardingsFor = (name: string) =>
    data.offboarding.filter((r) => isOpen(r) && canonicalName(r.name) === canonicalName(name));

  // On load, bring open requests in line with their ticks (new requests come
  // in from the form as blank / Pending; DocuSign can tick steps server-side).
  // Roster Onboarding always wins (Shihyun, 2026-11-10): anyone whose Roster
  // status is Onboarding but whose latest onboarding request is closed
  // (Active / Ended) gets that request reopened, on load and after every live
  // check, so the request tab matches and they show in Open items. Only
  // Onboarding: people set it by hand, while "Ending soon" is also set by the
  // nightly job, so matching that one by state would reopen old offboardings.
  // Each request is tried once per page load so a failing write can't loop.
  const matchTried = useRef(new Set<string>());
  async function matchRoster(d: DashboardData, st: StepState) {
    const todo: RequestEntry[] = [];
    for (const p of d.sot) {
      if ((p.rawStatus || "").trim().toLowerCase() !== "onboarding") continue;
      const mine = d.onboarding
        .filter((r) => canonicalName(r.name) === canonicalName(p.name))
        .sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
      const r = mine[0];
      if (!r || mine.some((x) => !x.closed) || !["active", "ended"].includes(r.status.trim().toLowerCase())) continue;
      if (matchTried.current.has(requestKey(r))) continue;
      matchTried.current.add(requestKey(r));
      todo.push(r);
    }
    if (!todo.length) return;
    const done: string[] = [];
    for (const r of todo) if (await setStatus(r, wantedStatus(r, st[requestKey(r)]), true)) done.push(r.name);
    const failed = todo.length - done.length;
    flash(
      [
        done.length ? `Roster says Onboarding, so reopened: ${done.join(", ")}` : "",
        failed ? `${failed} onboarding request${failed === 1 ? "" : "s"} couldn't be reopened, use Reopen request in the profile` : "",
      ].filter(Boolean).join(". "),
      failed > 0,
    );
  }
  const matchRef = useRef(matchRoster);
  matchRef.current = matchRoster;

  const synced = useRef(false);
  useEffect(() => {
    if (!stepsError) void matchRoster(data, steps);
    if (synced.current || stepsError) return;
    synced.current = true;
    const finish = data.offboarding.filter(
      (r) => isOpen(r) && allStepsDone(r, steps[requestKey(r)]) && sotEndedFor(r.name),
    );
    const todo = all.filter((r) => !finish.includes(r) && needsSync(r, steps[requestKey(r)]));
    if (finish.length) {
      (async () => {
        for (const r of finish) await setStatus(r, "Completed");
      })();
    }
    if (!todo.length) return;
    (async () => {
      let ok = 0;
      for (const r of todo) if (await setStatus(r, wantedStatus(r, steps[requestKey(r)]), true)) ok++;
      flash(ok === todo.length ? `Synced ${ok} request status${ok === 1 ? "" : "es"} with their checklists` : `Synced ${ok} of ${todo.length} request statuses; the rest failed, refresh to retry`, ok !== todo.length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setStep(r: RequestEntry, step: string, done: boolean) {
    return tracked(() => setStepNow(r, step, done));
  }
  async function setStepNow(r: RequestEntry, step: string, done: boolean) {
    const key = requestKey(r);
    const prev = steps[key]?.[step];
    const next = { ...(steps[key] || {}), [step]: done };
    setSteps((s) => ({ ...s, [key]: { ...(s[key] || {}), [step]: done } }));
    try {
      const res = await fetch("/api/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, type: r.source, contractor: r.name, step, done }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      if (step === CHANGED_CHOICE) flash(`${r.name}: ${done ? "scope or rate changed, DocuSign steps added" : "no change, short path"}`);
      if (r.source === "offboarding" && isOpen(r) && allStepsDone(r, next) && sotEndedFor(r.name)) {
        await setStatus(r, "Completed");
      } else if (needsSync(r, next)) await setStatus(r, wantedStatus(r, next));
    } catch (err) {
      setSteps((s) => ({ ...s, [key]: { ...(s[key] || {}), [step]: prev as boolean } }));
      flash(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }

  function setStatus(r: RequestEntry, status: string, quiet = false): Promise<boolean> {
    return tracked(() => setStatusNow(r, status, quiet));
  }
  async function setStatusNow(r: RequestEntry, status: string, quiet = false): Promise<boolean> {
    const key = requestKey(r);
    try {
      const res = await fetch("/api/contractors/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: r.source, rowIndex: r.rowIndex, name: r.name, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setStatusOverrides((o) => ({ ...o, [key]: status }));
      if (body.sotSync) setSotOverrides((o) => ({ ...o, [body.sotSync.rowIndex]: body.sotSync.status }));
      const sync = [
        body.sotSync ? `SoT status set to ${body.sotSync.status}` : "",
        body.sotEndSync ? `SoT end date set to ${body.sotEndSync.to}` : "",
      ].filter(Boolean).join(", ");
      if (!quiet) flash(`${r.name}: marked ${status}${sync ? `. ${sync}` : ""}`);
      return true;
    } catch (err) {
      if (!quiet) flash(`Couldn't update the Sheet: ${err instanceof Error ? err.message : String(err)}`, true);
      return false;
    }
  }

  function setSotStatus(p: SotEntry, status: string): Promise<boolean> {
    return tracked(() => setSotStatusNow(p, status));
  }
  async function setSotStatusNow(p: SotEntry, status: string): Promise<boolean> {
    try {
      const res = await fetch("/api/contractors/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "sot", rowIndex: p.rowIndex, name: p.name, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSotOverrides((o) => ({ ...o, [p.rowIndex]: status }));
      const extra = await followRoster(p.name, status.toLowerCase());
      flash(`${p.name}: SoT status set to ${status}${extra}`);
      return true;
    } catch (err) {
      flash(`Couldn't update the Sheet: ${err instanceof Error ? err.message : String(err)}`, true);
      return false;
    }
  }

  // Roster status moves the requests too (Shihyun, 2026-11-10), so the Roster
  // works as a manual rollback when something was marked done too early:
  //   Onboarding  -> reopen their latest onboarding request (Active / Ended)
  //   Active      -> close their open onboarding + extension requests as Active
  //   Ending soon -> reopen their latest Completed offboarding
  //   Ended       -> close an open offboarding if every step is ticked (11/9)
  // A reopened request gets the status its ticks call for (Pending / Action
  // Required), same as everywhere else. Action Required / Voided on the
  // Roster leave requests alone: there's no way to tell which one is meant.
  const latest = (rows: RequestEntry[], name: string) =>
    rows
      .filter((r) => canonicalName(r.name) === canonicalName(name))
      .sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""))[0];
  const openFor = (rows: RequestEntry[], name: string) =>
    rows.filter((r) => isOpen(r) && canonicalName(r.name) === canonicalName(name));
  async function reopen(r: RequestEntry | undefined, closedAs: string[]): Promise<boolean> {
    if (!r || isOpen(r) || !closedAs.includes(statusOf(r).trim().toLowerCase())) return false;
    return setStatus(r, wantedStatus(r, steps[requestKey(r)]), true);
  }
  async function followRoster(name: string, status: string): Promise<string> {
    const notes: string[] = [];
    if (status === "onboarding") {
      if (!openFor(data.onboarding, name).length && (await reopen(latest(data.onboarding, name), ["active", "ended"])))
        notes.push("Onboarding request reopened");
    } else if (status === "active") {
      let n = 0;
      for (const r of [...openFor(data.onboarding, name), ...openFor(data.extension, name)])
        if (await setStatus(r, "Active", true)) n++;
      if (n) notes.push(`${n === 1 ? "Open request" : `${n} open requests`} marked Active`);
    } else if (status === "ending soon") {
      if (!openFor(data.offboarding, name).length && (await reopen(latest(data.offboarding, name), ["completed"])))
        notes.push("Offboarding request reopened");
    } else if (status === "ended") {
      const open = openOffboardingsFor(name);
      const ready = open.filter((r) => allStepsDone(r, steps[requestKey(r)]));
      let closed = 0;
      for (const r of ready) if (await setStatus(r, "Completed", true)) closed++;
      if (closed) notes.push("Offboarding marked Completed");
      if (open.length - closed) notes.push("Offboarding still open: finish its steps or mark it Completed");
    }
    return notes.map((x) => `. ${x}`).join("");
  }

  // Dot on "What's new" until this browser has opened it since the newest entry.
  const LATEST = UPDATES[0]?.date || "";
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    try {
      setUnseen(localStorage.getItem("hub.updatesSeen") !== LATEST);
    } catch {
      /* storage blocked: no dot */
    }
  }, [LATEST]);
  function openView(k: View) {
    setView(k);
    if (k === "updates") {
      setUnseen(false);
      try {
        localStorage.setItem("hub.updatesSeen", LATEST);
      } catch {
        /* ignore */
      }
    }
  }

  const openCount = all.filter((r) => isOpen(r) && inRegion(r.owner, region)).length;
  const NAV: [View, string, string][] = [
    ["open", "Open items", String(openCount)],
    ["roster", "Roster", String(data.sot.filter((p) => inRegion(p.owner, region) && !["ended", "void", "voided"].includes(sotStatusOf(p).trim().toLowerCase())).length)],
    ["updates", "What's new", ""],
  ];

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          Contractor Hub<small>People Ops</small>
        </div>
        {viewerEmail && (
          <form action="/signout" method="POST" className="session">
            <span title={`Signed in as ${viewerEmail}`}>Signed in as {viewerEmail}</span>
            <button type="submit" className="btn">Sign out</button>
          </form>
        )}
        <nav className="nav" aria-label="Sections">
          {NAV.map(([k, l, c]) => (
            <button key={k} type="button" aria-current={view === k ? "page" : undefined} onClick={() => openView(k)}>
              <span>{l}</span>
              {k === "updates" && unseen ? <span className="newdot" aria-label="New updates" /> : <span className="count">{c}</span>}
            </button>
          ))}
        </nav>
        <div className="viewer">
          <span>Region</span>
          <div className="seg">
            {REGIONS.map((r) => (
              <button key={r.key} type="button" aria-pressed={region === r.key} onClick={() => setRegion(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="railfoot">
            <button
              type="button"
              className={`sync ${refreshing ? "busy" : syncFailed ? "off" : ""}`}
              disabled={refreshing}
              onClick={() => poll(true)}
              title="Live from the Sheet: checks every 30 seconds. Click to check now."
              aria-live="polite"
            >
              <span className="syncdot" aria-hidden="true" />
              <span className="synctext">
                {refreshing
                  ? "Syncing…"
                  : syncFailed
                    ? "Sync paused, retrying"
                    : syncedAt
                      ? `Synced ${syncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                      : "Live"}
              </span>
              <svg className="syncicon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="footlinks">
              <a href="/classic">Classic view</a>
              <a href="mailto:shihyun.l@usespeak.com" title="Owner: shihyun.l@usespeak.com">Owner</a>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        {view === "open" ? (
          <OpenItems
            data={data}
            region={region}
            steps={steps}
            statusOf={statusOf}
            isOpen={isOpen}
            onStep={setStep}
            onStatus={setStatus}
            flash={flash}
            onOpen={setProfile}
          />
        ) : view === "roster" ? (
          <Roster data={data} region={region} onOpen={setProfile} statusOf={sotStatusOf} onStatus={setSotStatus} />
        ) : (
          <Updates />
        )}
      </main>
      {profile && (
        <Profile
          name={profile}
          data={data}
          steps={steps}
          statusOf={statusOf}
          isOpen={isOpen}
          sotStatusOf={sotStatusOf}
          onStatus={setStatus}
          onSotStatus={setSotStatus}
          onReopen={async (r) => {
            if (await setStatus(r, wantedStatus(r, steps[requestKey(r)]), true)) flash(`${r.name}: request reopened, it's back in Open items`);
            else flash(`Couldn't reopen ${r.name}'s request. Try again, or change its status in the Sheet.`, true);
          }}
          onClose={() => setProfile(null)}
        />
      )}
      {toast && (
        <div className={`toast ${toast.err ? "err" : ""}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

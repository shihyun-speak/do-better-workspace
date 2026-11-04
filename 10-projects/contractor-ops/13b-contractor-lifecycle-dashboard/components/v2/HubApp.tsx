"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData, RequestEntry, SotEntry } from "@/lib/parsers";
import { isClosedStatus } from "@/lib/parsers";
import type { StepState } from "@/lib/steps";
import { REGIONS, inRegion, type Region } from "@/lib/regions";
import { CHANGED_CHOICE, requestKey, stepsFor } from "@/lib/plans";
import OpenItems from "./OpenItems";
import Profile from "./Profile";
import Roster from "./Roster";
import Updates from "./Updates";
import { UPDATES } from "@/lib/updates";

// Redesign shell: nav, region switcher, toasts, and the write calls (step
// ticks + status changes) shared by every view.

type View = "open" | "roster" | "updates";

export default function HubApp({
  data,
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

  // On load, bring open requests in line with their ticks (new requests come
  // in from the form as blank / Pending; DocuSign can tick steps server-side).
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || stepsError) return;
    synced.current = true;
    const todo = all.filter((r) => needsSync(r, steps[requestKey(r)]));
    if (!todo.length) return;
    (async () => {
      let ok = 0;
      for (const r of todo) if (await setStatus(r, wantedStatus(r, steps[requestKey(r)]), true)) ok++;
      flash(ok === todo.length ? `Synced ${ok} request status${ok === 1 ? "" : "es"} with their checklists` : `Synced ${ok} of ${todo.length} request statuses; the rest failed, refresh to retry`, ok !== todo.length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStep(r: RequestEntry, step: string, done: boolean) {
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
      if (needsSync(r, next)) await setStatus(r, wantedStatus(r, next));
    } catch (err) {
      setSteps((s) => ({ ...s, [key]: { ...(s[key] || {}), [step]: prev as boolean } }));
      flash(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }

  async function setStatus(r: RequestEntry, status: string, quiet = false): Promise<boolean> {
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

  async function setSotStatus(p: SotEntry, status: string): Promise<boolean> {
    try {
      const res = await fetch("/api/contractors/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "sot", rowIndex: p.rowIndex, name: p.name, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSotOverrides((o) => ({ ...o, [p.rowIndex]: status }));
      flash(`${p.name}: SoT status set to ${status}`);
      return true;
    } catch (err) {
      flash(`Couldn't update the Sheet: ${err instanceof Error ? err.message : String(err)}`, true);
      return false;
    }
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
          <a className="btn classic" href="/classic">Classic view (v1)</a>
          <p className="ownerline">
            Owner: <a href="mailto:shihyun.l@usespeak.com">shihyun.l@usespeak.com</a>
          </p>
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

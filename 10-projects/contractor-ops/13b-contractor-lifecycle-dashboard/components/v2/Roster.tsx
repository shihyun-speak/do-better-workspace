"use client";

import { useState } from "react";
import type { DashboardData, SotEntry } from "@/lib/parsers";
import { parseDate, workingDaysUntil } from "@/lib/dates";
import { inRegion, type Region } from "@/lib/regions";
import { STATUS_OPTIONS, sotStatusSideEffect } from "@/lib/statuses";
import { OwnerPill } from "./OpenItems";
import StatusSelect from "./StatusSelect";

// Roster: the SoT tab as-is. One tab per value of the Status column exactly
// as the Sheet has it (no auto-derived "Ending Soon" / "Expired"), in sheet
// row order. The Status dropdown writes SoT col H, same as the Sheet's own.

const INACTIVE = new Set(["ended", "void", "voided"]);
// Group order; any other value the Sheet has is listed after these.
const ORDER = ["onboarding", "active", "ending soon", "action required", "", "ended", "voided", "void"];
const TONE: Record<string, string> = {
  onboarding: "st-onb",
  active: "st-ok",
  "ending soon": "s-warn",
  "action required": "s-bad",
  ended: "st-ended",
};

function fmt(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—";
}

export default function Roster({
  data,
  region,
  onOpen,
  statusOf,
  onStatus,
}: {
  data: DashboardData;
  region: Region;
  onOpen: (name: string) => void;
  statusOf: (p: SotEntry) => string;
  onStatus: (p: SotEntry, status: string) => Promise<boolean>;
}) {
  const key = (p: SotEntry) => statusOf(p).trim().toLowerCase();
  const people = data.sot.filter((p) => inRegion(p.owner, region));
  const groups = new Map<string, SotEntry[]>();
  for (const p of [...people].sort((a, b) => a.rowIndex - b.rowIndex)) {
    groups.set(key(p), [...(groups.get(key(p)) || []), p]);
  }
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.indexOf(""));
  // One tab per Status value the Sheet has; Active always shows.
  if (!groups.has("active")) groups.set("active", []);
  const tabs = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
  const labelOf = (k: string) => (groups.get(k)?.[0] && statusOf(groups.get(k)![0])) || (k ? k[0].toUpperCase() + k.slice(1) : "No status");

  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const current = groups.has(tab) ? tab : "active";
  const needle = q.trim().toLowerCase();
  const rows = (groups.get(current) || []).filter(
    (p) => !needle || [p.name, p.jobTitle, p.department, p.manager, p.approver].some((v) => v.toLowerCase().includes(needle)),
  );
  const regionLabel = region === "all" ? "All regions" : region === "apac" ? "APAC" : "US + RoW";

  return (
    <>
      <div className="pagehead">
        <span className="preview">Preview</span>
        <h1>Roster</h1>
        <p className="sub">{regionLabel}, straight from the [SoT] Contractor Tracker Status column</p>
      </div>
      <div className="rosterbar">
        <div className="typetabs" role="tablist">
          {tabs.map(([k, ps]) => (
            <button key={k || "blank"} type="button" role="tab" className={`t-roster ${TONE[k] || "st-neutral"}-tab`} aria-selected={current === k} onClick={() => setTab(k)}>
              {labelOf(k)}
              <span className="num">{ps.length}</span>
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Search name, role, manager" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length ? (
        <section className="panel">
          <div className="tablewrap">
            <table className="roster">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Manager</th>
                  <th>Approver</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th className="r">Row</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const end = parseDate(p.endDate);
                  // Flag Sheet statuses that the end date no longer agrees with.
                  const lapsed = !INACTIVE.has(current) && end && workingDaysUntil(end) < 0;
                  return (
                    <tr key={p.rowIndex}>
                      <td>
                        <button type="button" className="namebtn" onClick={() => onOpen(p.name)}>{p.name}</button>
                        {(p.jobTitle || p.department) && <div className="role">{[p.jobTitle, p.department].filter(Boolean).join(", ")}</div>}
                      </td>
                      <td><OwnerPill owner={p.owner} country={p.country} /></td>
                      <td>{p.manager || "—"}</td>
                      <td>{p.approver || "—"}</td>
                      <td className="mono">{fmt(p.startDate)}</td>
                      <td className="mono">
                        {fmt(p.endDate)}
                        {lapsed && <span className="pill s-bad lapsed">Past end date</span>}
                      </td>
                      <td>
                        <StatusSelect value={statusOf(p)} options={STATUS_OPTIONS.sot} what={`${p.name}'s SoT status`} note={sotStatusSideEffect} onChange={(next) => onStatus(p, next)} />
                      </td>
                      <td className="mono r faintc">{p.rowIndex}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="panel empty">No {labelOf(current)} contractors in {regionLabel}{needle ? ` matching "${q}"` : ""}.</p>
      )}
    </>
  );
}

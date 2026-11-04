"use client";

import { useEffect, useMemo, useState } from "react";
import type { LogEntry } from "@/lib/activityLog";

// Automation log viewer. Reads /api/activity (the "POps Automation Log"
// sheet). `reloadKey` bumps when the dashboard's Refresh button is pressed.

const RESULT_PILL: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Failed: "bg-rose-50 text-rose-700 ring-rose-200",
  Skipped: "bg-slate-100 text-slate-600 ring-slate-200",
};

function fmtKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ActivityLog({
  search,
  reloadKey,
}: {
  search: string;
  reloadKey: number;
}) {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automation, setAutomation] = useState<string>("all");
  const [failedOnly, setFailedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/activity", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        return body as { enabled: boolean; entries: LogEntry[] };
      })
      .then((body) => {
        if (cancelled) return;
        setEnabled(body.enabled);
        setEntries(body.entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Per-automation summary: last run + failures in the last 7 days.
  const summaries = useMemo(() => {
    if (!entries) return [];
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const byName = new Map<string, { last: LogEntry; count7d: number; failed7d: number }>();
    for (const e of entries) {
      const s = byName.get(e.automation) || { last: e, count7d: 0, failed7d: 0 };
      if (new Date(e.timestamp).getTime() >= weekAgo) {
        s.count7d += 1;
        if (e.result === "Failed") s.failed7d += 1;
      }
      byName.set(e.automation, s);
    }
    return [...byName.entries()].map(([name, s]) => ({ name, ...s }));
  }, [entries]);

  const rows = useMemo(() => {
    if (!entries) return [];
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (automation !== "all" && e.automation !== automation) return false;
      if (failedOnly && e.result !== "Failed") return false;
      if (!q) return true;
      return [e.automation, e.person, e.action, e.details, e.trigger]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, automation, failedOnly, search]);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-medium">Failed to load the automation log</p>
        <p className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</p>
      </div>
    );
  }
  if (!enabled) {
    return <p className="text-sm text-slate-500">The automation log is turned off.</p>;
  }
  if (!entries) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No automation runs logged yet. The SoT status sync logs its first run on the
        next weekday morning (8–9am KST).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setAutomation(automation === s.name ? "all" : s.name)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
              automation === s.name
                ? "border-indigo-400 ring-1 ring-indigo-400"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{s.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  RESULT_PILL[s.last.result] || RESULT_PILL.OK
                }`}
              >
                {s.last.result}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Last: {fmtKst(s.last.timestamp)} KST</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Last 7 days: {s.count7d} entries
              {s.failed7d > 0 && <span className="text-rose-600"> · {s.failed7d} failed</span>}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-slate-600">
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(e) => setFailedOnly(e.target.checked)}
          />
          Failed only
        </label>
        {automation !== "all" && (
          <button
            type="button"
            onClick={() => setAutomation("all")}
            className="rounded-md bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Showing {automation} · clear
          </button>
        )}
        <span className="ml-auto text-slate-400">{rows.length} entries</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              {["When (KST)", "Automation", "Person", "Action", "Result", "Trigger", "Details"].map(
                (h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((e, i) => (
              <tr key={`${e.timestamp}-${i}`} className={e.person ? "" : "bg-slate-50/60"}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtKst(e.timestamp)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{e.automation}</td>
                <td className="px-3 py-2 text-slate-800">
                  <div className="max-w-[22ch]">{e.person || <span className="text-slate-400">Run</span>}</div>
                </td>
                <td className="px-3 py-2 text-slate-700">{e.action}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      RESULT_PILL[e.result] || RESULT_PILL.OK
                    }`}
                  >
                    {e.result}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{e.trigger}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  <div className="max-w-[40ch] break-words">{e.details}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

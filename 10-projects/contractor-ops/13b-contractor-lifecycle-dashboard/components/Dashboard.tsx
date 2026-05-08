"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData, RequestEntry, RequestSource, SotEntry } from "@/lib/parsers";
import type { Owner } from "@/lib/owners";
import { ownerLabel } from "@/lib/owners";
import { fmtDate, workingDaysUntil } from "@/lib/dates";

type TabKey =
  | "sot"
  | "onboarding"
  | "extension"
  | "offboarding"
  | "rate_change"
  | "inactive";

const STATUS_OPTIONS: Record<RequestSource, string[]> = {
  onboarding: ["Pending", "Action Required", "Active", "Ended", "Void"],
  extension: ["Pending", "Action Required", "Active", "Void"],
  offboarding: ["Pending", "Action Required", "Completed", "Void"],
  rate_change: ["Pending", "Action Required", "Completed", "Void"],
};

// SoT statuses (Active Roster) — mirrors the sheet's own dropdown chip set.
// "Ending Soon" is also auto-derived from the contract end date when the
// saved status is plain "Active" — but we still expose it manually since the
// sheet's dropdown includes it as a real option.
const SOT_STATUS_OPTIONS = [
  "Active",
  "Onboarding",
  "Pending",
  "Action Required",
  "Ending Soon",
  "Ended",
  "Voided",
];

/**
 * Match the Google Sheets dropdown chip colors used in the source sheet.
 * Returns Tailwind classes (border + bg + text) for a given status string.
 */
function chipClasses(status: string): string {
  const s = status.trim().toLowerCase();
  switch (s) {
    case "active":
      return "border-green-200 bg-green-100 text-green-900";
    case "onboarding":
      return "border-yellow-200 bg-yellow-100 text-yellow-900";
    case "pending":
      // Pending isn't in the SoT chip set but appears on request tabs —
      // pick a yellow-leaning pastel that reads as "in progress".
      return "border-amber-200 bg-amber-100 text-amber-900";
    case "action required":
      return "border-red-200 bg-red-100 text-red-900";
    case "ending soon":
    case "expired":
      return "border-orange-200 bg-orange-100 text-orange-900";
    case "ended":
      return "border-slate-700 bg-slate-700 text-white";
    case "voided":
    case "void":
    case "completed":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "data error":
      return "border-rose-300 bg-rose-100 text-rose-900";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "sot", label: "Active Roster" },
  { key: "onboarding", label: "Onboarding" },
  { key: "extension", label: "Extension" },
  { key: "offboarding", label: "Offboarding" },
  { key: "rate_change", label: "Rate Change" },
  { key: "inactive", label: "Inactive" },
];

const OWNER_FILTERS: { key: Owner | "all"; label: string }[] = [
  { key: "all", label: "All owners" },
  { key: "apac", label: "Shihyun (APAC)" },
  { key: "row", label: "Hemmi (US + RoW)" },
  { key: "unknown", label: "Unknown" },
];

export default function Dashboard({
  initialData,
  initialError,
  viewer,
}: {
  initialData: DashboardData | null;
  initialError: string | null;
  viewer: { email: string; name: string | null } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("sot");
  const [ownerFilter, setOwnerFilter] = useState<Owner | "all">("all");
  const [search, setSearch] = useState("");
  // Override maps keyed by `${source}:${rowIndex}` so optimistic edits survive
  // until the next fetch reflects the change.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [sotOverrides, setSotOverrides] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const data = initialData;

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Bust the server cache and re-render the page with fresh data.
      await fetch("/api/contractors/refresh", { method: "POST" });
      // Drop optimistic overrides — incoming data is the new truth.
      setOverrides({});
      setSotOverrides({});
      router.refresh();
    } finally {
      // Give the rerender a beat to settle so the spinner doesn't flash.
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  const sotPartitions = useMemo(() => {
    if (!data) return { active: [], inactive: [] };
    const active: SotEntry[] = [];
    const inactive: SotEntry[] = [];
    for (const r of data.sot) {
      const override = sotOverrides[`sot:${r.rowIndex}`];
      const merged = override
        ? { ...r, rawStatus: override, displayStatus: override }
        : r;
      if (merged.lifecycle === "inactive") inactive.push(merged);
      else active.push(merged);
    }
    return { active, inactive };
  }, [data, sotOverrides]);

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      sot: sotPartitions.active.length,
      onboarding: data.onboarding.length,
      extension: data.extension.length,
      offboarding: data.offboarding.length,
      rate_change: data.rateChange.length,
      inactive: sotPartitions.inactive.length,
    };
  }, [data, sotPartitions]);

  if (initialError) {
    return <ErrorBanner message={initialError} />;
  }
  if (!data) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Header
        fetchedAt={data.fetchedAt}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        viewer={viewer}
      />

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {t.label}
            {counts && (
              <span className={`ml-2 ${tab === t.key ? "text-slate-300" : "text-slate-400"}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {OWNER_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setOwnerFilter(f.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                ownerFilter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, manager, country…"
          className="ml-auto w-full max-w-xs rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      <section>
        {tab === "sot" ? (
          <SotTable
            rows={sotPartitions.active}
            ownerFilter={ownerFilter}
            search={search}
            mode="active"
            onStatusChange={(entry, next) =>
              handleSotStatusChange(entry, next, setSotOverrides)
            }
          />
        ) : tab === "inactive" ? (
          <SotTable
            rows={sotPartitions.inactive}
            ownerFilter={ownerFilter}
            search={search}
            mode="inactive"
            onStatusChange={(entry, next) =>
              handleSotStatusChange(entry, next, setSotOverrides)
            }
          />
        ) : (
          <RequestTable
            rows={applyOverrides(
              tab === "onboarding"
                ? data.onboarding
                : tab === "extension"
                  ? data.extension
                  : tab === "offboarding"
                    ? data.offboarding
                    : data.rateChange,
              overrides,
            )}
            ownerFilter={ownerFilter}
            search={search}
            tab={tab}
            onStatusChange={(entry, next) =>
              handleStatusChange(entry, next, setOverrides)
            }
          />
        )}
      </section>
    </div>
  );
}

function entryKey(e: RequestEntry): string {
  return `${e.source}:${e.rowIndex}`;
}

function applyOverrides(
  rows: RequestEntry[],
  overrides: Record<string, string>,
): RequestEntry[] {
  if (Object.keys(overrides).length === 0) return rows;
  return rows.map((r) => {
    const o = overrides[entryKey(r)];
    return o ? { ...r, status: o } : r;
  });
}

async function handleStatusChange(
  entry: RequestEntry,
  next: string,
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const k = entryKey(entry);
  const previous = entry.status;
  setOverrides((m) => ({ ...m, [k]: next }));
  try {
    const res = await fetch("/api/contractors/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: entry.source,
        rowIndex: entry.rowIndex,
        name: entry.name,
        status: next,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    setOverrides((m) => ({ ...m, [k]: previous }));
    alert(`Status update failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function handleSotStatusChange(
  entry: SotEntry,
  next: string,
  setSotOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const k = `sot:${entry.rowIndex}`;
  const previous = entry.rawStatus;
  setSotOverrides((m) => ({ ...m, [k]: next }));
  try {
    const res = await fetch("/api/contractors/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "sot",
        rowIndex: entry.rowIndex,
        name: entry.name,
        status: next,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    setSotOverrides((m) => ({ ...m, [k]: previous }));
    alert(`Status update failed: ${err instanceof Error ? err.message : err}`);
  }
}

function Header({
  fetchedAt,
  onRefresh,
  refreshing,
  viewer,
}: {
  fetchedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
  viewer: { email: string; name: string | null } | null;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Global Contractor Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Live mirror of the Contractor Tracker sheet.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-400">
          Updated {new Date(fetchedAt).toLocaleString()}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={`inline-block ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          >
            ↻
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        {viewer && <SignOutButton email={viewer.email} />}
      </div>
    </header>
  );
}

function SignOutButton({ email }: { email: string }) {
  return (
    <form action="/signout" method="POST" className="contents">
      <button
        type="submit"
        title={`Signed in as ${email}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        <span aria-hidden>↪</span>
        Sign out
        <span className="hidden text-slate-400 sm:inline">· {email}</span>
      </button>
    </form>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-medium">Failed to load contractor data</p>
      <p className="mt-1 whitespace-pre-wrap font-mono text-xs">{message}</p>
    </div>
  );
}

function ownerBadgeColor(owner: Owner): string {
  if (owner === "apac") return "bg-emerald-100 text-emerald-800";
  if (owner === "row") return "bg-sky-100 text-sky-800";
  return "bg-slate-200 text-slate-700";
}

function urgencyBadge(workingDays: number | null): {
  label: string;
  cls: string;
} | null {
  if (workingDays === null) return null;
  if (workingDays < 0) {
    return {
      label: `${Math.abs(workingDays)} working day${Math.abs(workingDays) === 1 ? "" : "s"} ago`,
      cls: "bg-rose-100 text-rose-800",
    };
  }
  if (workingDays <= 7) {
    return {
      label: `${workingDays} working day${workingDays === 1 ? "" : "s"} left`,
      cls: "bg-rose-100 text-rose-800",
    };
  }
  if (workingDays <= 14) {
    return {
      label: `${workingDays} working days left`,
      cls: "bg-amber-100 text-amber-800",
    };
  }
  return {
    label: `${workingDays} working days left`,
    cls: "bg-slate-100 text-slate-700",
  };
}

function matchesSearch(haystacks: (string | null | undefined)[], needle: string) {
  if (!needle.trim()) return true;
  const n = needle.toLowerCase();
  return haystacks.some((h) => (h || "").toLowerCase().includes(n));
}

// --- Table primitives ---------------------------------------------------

type SortDir = "asc" | "desc";
type SortState<K extends string> = { col: K; dir: SortDir };

const FLAG_STATUSES = new Set(["pending", "action required"]);
const isFlagged = (status: string) =>
  FLAG_STATUSES.has(status.trim().toLowerCase());

function HeaderCell({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 cursor-pointer select-none border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={onClick}
    >
      {label}
      <span className="ml-1 text-slate-400">{arrow}</span>
    </th>
  );
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareDates(a: string | null, b: string | null): number {
  const ad = a ? Date.parse(a) : Infinity;
  const bd = b ? Date.parse(b) : Infinity;
  return ad - bd;
}

function OwnerPill({ owner }: { owner: Owner }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ownerBadgeColor(owner)}`}
      title={ownerLabel(owner)}
    >
      {owner === "apac" ? "APAC" : owner === "row" ? "RoW" : "?"}
    </span>
  );
}

function UrgencyCell({ workingDays }: { workingDays: number | null }) {
  const badge = urgencyBadge(workingDays);
  if (!badge) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}

// --- SOT Table ----------------------------------------------------------

type SotSortCol =
  | "name"
  | "country"
  | "manager"
  | "approver"
  | "end"
  | "owner"
  | "status";

function SotTable({
  rows,
  ownerFilter,
  search,
  mode,
  onStatusChange,
}: {
  rows: SotEntry[];
  ownerFilter: Owner | "all";
  search: string;
  mode: "active" | "inactive";
  onStatusChange: (entry: SotEntry, next: string) => void;
}) {
  const [sort, setSort] = useState<SortState<SotSortCol>>(
    mode === "active"
      ? { col: "end", dir: "asc" }
      : { col: "end", dir: "desc" },
  );

  const filtered = rows.filter((r) => {
    if (ownerFilter !== "all" && r.owner !== ownerFilter) return false;
    return matchesSearch(
      [r.name, r.manager, r.approver, r.country, r.jobTitle, r.department],
      search,
    );
  });

  // Priority groups for the active tab: pin onboarding + ending-soon above
  // the rest so the things that need attention float to the top regardless
  // of the chosen sort column. Inactive tab gets no priority bump.
  const priorityFor = (r: SotEntry): number => {
    if (mode !== "active") return 0;
    if (r.lifecycle === "onboarding") return 2;
    if (r.lifecycle === "ending_soon") return 2;
    return 0;
  };

  const sorted = [...filtered].sort((a, b) => {
    const pa = priorityFor(a);
    const pb = priorityFor(b);
    if (pa !== pb) return pb - pa; // higher priority first

    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.col) {
      case "name":
        return compareStrings(a.name, b.name) * dir;
      case "country":
        return compareStrings(a.country || "", b.country || "") * dir;
      case "manager":
        return compareStrings(a.manager || "", b.manager || "") * dir;
      case "approver":
        return compareStrings(a.approver || "", b.approver || "") * dir;
      case "owner":
        return compareStrings(a.owner, b.owner) * dir;
      case "status":
        return compareStrings(a.displayStatus, b.displayStatus) * dir;
      case "end":
        return compareDates(a.endDate, b.endDate) * dir;
    }
  });

  if (sorted.length === 0) return <EmptyState />;

  const toggle = (col: SotSortCol) => () =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" },
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            <HeaderCell label="Name" active={sort.col === "name"} dir={sort.dir} onClick={toggle("name")} />
            <HeaderCell label="Owner" active={sort.col === "owner"} dir={sort.dir} onClick={toggle("owner")} />
            <HeaderCell label="Country" active={sort.col === "country"} dir={sort.dir} onClick={toggle("country")} />
            <HeaderCell label="Manager" active={sort.col === "manager"} dir={sort.dir} onClick={toggle("manager")} />
            <HeaderCell label="Approver" active={sort.col === "approver"} dir={sort.dir} onClick={toggle("approver")} />
            <HeaderCell label="Status" active={sort.col === "status"} dir={sort.dir} onClick={toggle("status")} />
            <HeaderCell label="Contract end" active={sort.col === "end"} dir={sort.dir} onClick={toggle("end")} />
            {mode === "active" && (
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Urgency
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => {
            const end = r.endDate ? new Date(r.endDate) : null;
            const wd = end ? workingDaysUntil(end) : null;
            const rowTint =
              r.lifecycle === "onboarding"
                ? "bg-yellow-50/70 hover:bg-yellow-100/70"
                : r.lifecycle === "ending_soon"
                  ? "bg-orange-50/70 hover:bg-orange-100/70"
                  : mode === "inactive"
                    ? "bg-slate-50/60 hover:bg-slate-100/60"
                    : "hover:bg-slate-50";
            return (
              <tr key={`sot-${r.name}-${r.startDate ?? ""}-${r.endDate ?? ""}`} className={rowTint}>
                <td className="px-3 py-2">
                  <div className={`font-medium ${mode === "inactive" ? "text-slate-500" : "text-slate-900"}`}>
                    {r.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[r.jobTitle, r.department].filter(Boolean).join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-3 py-2"><OwnerPill owner={r.owner} /></td>
                <td className="px-3 py-2 text-slate-700">{r.country || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.manager || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.approver || "—"}</td>
                <td className="px-3 py-2">
                  <SotStatusSelect
                    entry={r}
                    onChange={(next) => onStatusChange(r, next)}
                  />
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {end ? fmtDate(end) : "—"}
                </td>
                {mode === "active" && (
                  <td className="px-3 py-2"><UrgencyCell workingDays={wd} /></td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SotStatusSelect({
  entry,
  onChange,
}: {
  entry: SotEntry;
  onChange: (next: string) => void;
}) {
  const current = entry.rawStatus || "";
  // Always offer the canonical writeable set; include the current value at
  // the front if it's outside that set (e.g. an old "Onboarding" string),
  // so the select doesn't silently coerce it.
  const options =
    SOT_STATUS_OPTIONS.includes(current) || !current
      ? SOT_STATUS_OPTIONS
      : [current, ...SOT_STATUS_OPTIONS];

  // Use the chip palette so the dashboard matches the Sheet's dropdown chips.
  // The displayStatus already reflects "Ending Soon" / "Expired" auto-tags
  // when applicable; otherwise it's whatever's saved in the cell.
  const cls = chipClasses(entry.displayStatus);

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== current) onChange(next);
        }}
        className={`rounded-md border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 ${cls}`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "—"}
          </option>
        ))}
      </select>
      {entry.lifecycle === "ending_soon" && (
        <span className="text-[10px] font-medium text-amber-700">
          ⚠ Ending Soon (auto)
        </span>
      )}
      {entry.lifecycle === "inactive" && entry.displayStatus === "Expired" && (
        <span className="text-[10px] font-medium text-rose-700">
          ⚠ Past end date
        </span>
      )}
      {entry.lifecycle === "inactive" && entry.displayStatus === "Data error" && (
        <span className="text-[10px] font-medium text-rose-700">
          ⚠ Sheet data error
        </span>
      )}
    </div>
  );
}

// --- Request Table ------------------------------------------------------

type ReqSortCol = "flag" | "name" | "owner" | "country" | "manager" | "approver" | "status" | "date";

function RequestTable({
  rows,
  ownerFilter,
  search,
  tab,
  onStatusChange,
}: {
  rows: RequestEntry[];
  ownerFilter: Owner | "all";
  search: string;
  tab: TabKey;
  onStatusChange: (entry: RequestEntry, next: string) => void;
}) {
  const [sort, setSort] = useState<SortState<ReqSortCol>>({
    col: "flag",
    dir: "desc", // flagged rows first
  });

  const filtered = rows.filter((r) => {
    if (ownerFilter !== "all" && r.owner !== ownerFilter) return false;
    return matchesSearch(
      [r.name, r.manager, r.approver, r.country, r.status],
      search,
    );
  });

  const dateFor = (r: RequestEntry): string | null => {
    if (tab === "onboarding") return r.startDate;
    if (tab === "extension") return r.priorEndDate;
    if (tab === "offboarding") return r.endDate;
    if (tab === "rate_change") return r.effectiveDate;
    return null;
  };

  const dateLabel =
    tab === "onboarding"
      ? "Starts"
      : tab === "extension"
        ? "Current end"
        : tab === "offboarding"
          ? "Ends"
          : "Effective";

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.col) {
      case "flag": {
        const af = isFlagged(a.status) ? 1 : 0;
        const bf = isFlagged(b.status) ? 1 : 0;
        if (af !== bf) return (bf - af) * (dir > 0 ? 1 : -1);
        return compareDates(dateFor(a), dateFor(b));
      }
      case "name":
        return compareStrings(a.name, b.name) * dir;
      case "country":
        return compareStrings(a.country || "", b.country || "") * dir;
      case "manager":
        return compareStrings(a.manager || "", b.manager || "") * dir;
      case "approver":
        return compareStrings(a.approver || "", b.approver || "") * dir;
      case "owner":
        return compareStrings(a.owner, b.owner) * dir;
      case "status":
        return compareStrings(a.status || "", b.status || "") * dir;
      case "date":
        return compareDates(dateFor(a), dateFor(b)) * dir;
    }
  });

  if (sorted.length === 0) return <EmptyState />;

  const toggle = (col: ReqSortCol) => () =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "flag" ? "desc" : "asc" },
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            <HeaderCell label="" active={sort.col === "flag"} dir={sort.dir} onClick={toggle("flag")} />
            <HeaderCell label="Name" active={sort.col === "name"} dir={sort.dir} onClick={toggle("name")} />
            <HeaderCell label="Owner" active={sort.col === "owner"} dir={sort.dir} onClick={toggle("owner")} />
            <HeaderCell label="Country" active={sort.col === "country"} dir={sort.dir} onClick={toggle("country")} />
            <HeaderCell label="Manager" active={sort.col === "manager"} dir={sort.dir} onClick={toggle("manager")} />
            <HeaderCell label="Approver" active={sort.col === "approver"} dir={sort.dir} onClick={toggle("approver")} />
            <HeaderCell label="Status" active={sort.col === "status"} dir={sort.dir} onClick={toggle("status")} />
            <HeaderCell label={dateLabel} active={sort.col === "date"} dir={sort.dir} onClick={toggle("date")} />
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Urgency
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => {
            const d = dateFor(r);
            const wd = d ? workingDaysUntil(new Date(d)) : null;
            const flagged = isFlagged(r.status);
            const sLower = r.status.trim().toLowerCase();
            const tint =
              sLower === "action required"
                ? "bg-red-50/70 hover:bg-red-100/70"
                : sLower === "pending"
                  ? "bg-amber-50/70 hover:bg-amber-100/70"
                  : "hover:bg-slate-50";
            const dotCls =
              sLower === "action required"
                ? "bg-red-500"
                : sLower === "pending"
                  ? "bg-amber-500"
                  : "";
            return (
              <tr key={`${r.source}-${r.rowIndex}`} className={tint}>
                <td className="px-2 py-2 text-center">
                  {flagged ? (
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${dotCls}`}
                      title={r.status}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.requestType}</div>
                </td>
                <td className="px-3 py-2"><OwnerPill owner={r.owner} /></td>
                <td className="px-3 py-2 text-slate-700">{r.country || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.manager || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.approver || "—"}</td>
                <td className="px-3 py-2">
                  <StatusSelect
                    entry={r}
                    onChange={(next) => onStatusChange(r, next)}
                  />
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {tab === "extension" && r.priorEndDate && r.newEndDate ? (
                    <span>
                      {fmtDate(new Date(r.priorEndDate))}
                      <span className="mx-1 text-slate-400">→</span>
                      {fmtDate(new Date(r.newEndDate))}
                    </span>
                  ) : d ? (
                    fmtDate(new Date(d))
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2"><UrgencyCell workingDays={wd} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusSelect({
  entry,
  onChange,
}: {
  entry: RequestEntry;
  onChange: (next: string) => void;
}) {
  const options = STATUS_OPTIONS[entry.source];
  const current = entry.status || "";
  const all = options.includes(current) || !current ? options : [current, ...options];
  return (
    <select
      value={current}
      onChange={(e) => {
        const next = e.target.value;
        if (next !== current) onChange(next);
      }}
      className={`rounded-md border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 ${chipClasses(current)}`}
    >
      {all.map((opt) => (
        <option key={opt} value={opt}>
          {opt || "—"}
        </option>
      ))}
    </select>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
      Nothing matches the current filters.
    </div>
  );
}

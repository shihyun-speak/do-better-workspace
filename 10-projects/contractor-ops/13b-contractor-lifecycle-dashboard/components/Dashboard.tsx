"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData, RequestEntry, RequestSource, SotEntry } from "@/lib/parsers";
import { classifySot, isClosedStatus } from "@/lib/parsers";
import type { Owner } from "@/lib/owners";
import { canonicalName, formatCountry, ownerLabel } from "@/lib/owners";
import { fmtDate, fmtDateShort, workingDaysUntil } from "@/lib/dates";
import ActivityLog from "@/components/ActivityLog";

type TabKey =
  | "sot"
  | "onboarding"
  | "extension"
  | "offboarding"
  | "rate_change"
  | "inactive"
  | "activity";

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
  { key: "activity", label: "Activity" },
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
  // Optimistic end-date overrides for SoT col G — set when a request-tab
  // status change (Extension → Active, early Offboarding) triggers the
  // server-side end-date sync. Keyed by `sot:${rowIndex}` → ISO date.
  const [sotEndOverrides, setSotEndOverrides] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on Refresh so the Activity tab re-fetches the automation log.
  const [activityReloadKey, setActivityReloadKey] = useState(0);

  // Hidden-column preferences per tab, persisted in localStorage. Lives in
  // the parent so the Columns toggle button can sit in the filter row,
  // separate from the table it controls.
  const [hiddenColsByTab, setHiddenColsByTab] = useState<Record<string, Set<string>>>(
    {},
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const merged: Record<string, Set<string>> = {};
      for (const t of ["onboarding", "extension", "offboarding", "rate_change"]) {
        const raw = localStorage.getItem(`req-cols-hidden:${t}`);
        merged[t] = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
      }
      setHiddenColsByTab(merged);
    } catch {
      /* ignore corrupt localStorage */
    }
  }, []);
  const toggleColVisibility = (tabKey: string, key: string) => {
    setHiddenColsByTab((prev) => {
      const current = new Set(prev[tabKey] || []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      const next = { ...prev, [tabKey]: current };
      try {
        localStorage.setItem(`req-cols-hidden:${tabKey}`, JSON.stringify(Array.from(current)));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };

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
      setSotEndOverrides({});
      setActivityReloadKey((k) => k + 1);
      router.refresh();
    } finally {
      // Give the rerender a beat to settle so the spinner doesn't flash.
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  /**
   * For each SoT contractor, find their earliest pending change to the
   * contract end date. A "pending change" is an Extension or Offboarding row
   * whose status is Pending / Action Required / blank (not Active/Completed/
   * Void). Offboarding only counts if its End Date is earlier than the
   * current SoT End Date (otherwise it doesn't shorten the timeline).
   * Returns Map<canonical name, { proposedEnd, source }>.
   */
  const pendingEndChange = useMemo(() => {
    if (!data) return new Map<string, { proposedEnd: string; source: "extension" | "offboarding" }>();
    const isPending = (s: string) => {
      const lower = s.trim().toLowerCase();
      return lower === "" || lower === "pending" || lower === "action required";
    };
    // Use override-merged status so an optimistic flip (e.g. Extension Active
    // → Pending in the request tab) takes effect on Active Roster's
    // current→proposed arrow without waiting for a refresh.
    const statusFor = (e: RequestEntry) =>
      overrides[`${e.source}:${e.rowIndex}`] ?? e.status;

    const sotEndByName = new Map<string, string | null>();
    for (const e of data.sot) {
      sotEndByName.set(canonicalName(e.name), e.endDate);
    }

    // Build a map of the most recent Active extension submission date per
    // contractor. A Pending extension older than this is "stale" — it was
    // superseded by a later approved extension but never voided. Showing it
    // as a current→proposed arrow misleads, so we ignore those.
    const latestActiveExtAt = new Map<string, string>();
    for (const ext of data.extension) {
      if (statusFor(ext).trim().toLowerCase() !== "active") continue;
      if (!ext.requestedAt) continue;
      const key = canonicalName(ext.name);
      const prev = latestActiveExtAt.get(key);
      if (!prev || ext.requestedAt > prev) {
        latestActiveExtAt.set(key, ext.requestedAt);
      }
    }

    const out = new Map<string, { proposedEnd: string; source: "extension" | "offboarding" }>();
    const consider = (
      key: string,
      candidate: string,
      source: "extension" | "offboarding",
    ) => {
      const prev = out.get(key);
      if (!prev || candidate < prev.proposedEnd) {
        out.set(key, { proposedEnd: candidate, source });
      }
    };
    for (const ext of data.extension) {
      if (!isPending(statusFor(ext)) || !ext.newEndDate) continue;
      const key = canonicalName(ext.name);
      // Skip if the proposed end matches the current SoT end — no actual
      // change is being proposed (e.g. SoT was already updated manually).
      const currentEnd = sotEndByName.get(key);
      if (currentEnd && ext.newEndDate === currentEnd) continue;
      // Skip stale Pending extensions superseded by a later Active one.
      const newestActive = latestActiveExtAt.get(key);
      if (newestActive && ext.requestedAt && ext.requestedAt < newestActive) {
        continue;
      }
      consider(key, ext.newEndDate, "extension");
    }
    for (const off of data.offboarding) {
      if (!isPending(statusFor(off)) || !off.endDate) continue;
      const key = canonicalName(off.name);
      const currentEnd = sotEndByName.get(key);
      if (currentEnd && off.endDate >= currentEnd) continue;
      consider(key, off.endDate, "offboarding");
    }
    return out;
  }, [data, overrides]);

  const sotPartitions = useMemo(() => {
    if (!data) return { active: [], inactive: [] };
    const active: SotEntry[] = [];
    const inactive: SotEntry[] = [];
    for (const r of data.sot) {
      const key = `sot:${r.rowIndex}`;
      const statusOverride = sotOverrides[key];
      const endOverride = sotEndOverrides[key];
      const rawStatus = statusOverride ?? r.rawStatus;
      const endDate = endOverride ?? r.endDate;
      // Re-run the classifier so an overridden status/end date moves the row
      // between active and inactive (e.g. "Ended" → drop to Inactive tab).
      const { lifecycle, displayStatus } = classifySot(
        rawStatus,
        endDate,
        false,
      );
      const merged: SotEntry =
        statusOverride || endOverride
          ? { ...r, rawStatus, endDate, lifecycle, displayStatus }
          : r;
      if (merged.lifecycle === "inactive") inactive.push(merged);
      else active.push(merged);
    }
    return { active, inactive };
  }, [data, sotOverrides, sotEndOverrides]);

  const counts = useMemo(() => {
    if (!data) return null;
    // Tab counts reflect *open* requests only — closed/completed rows are
    // visible in the table (greyed-out at the bottom) but don't inflate the
    // badge number, which exists to flag "you have N things to act on".
    const openOnly = (rows: RequestEntry[]) => rows.filter((r) => !r.closed).length;
    return {
      sot: sotPartitions.active.length,
      onboarding: openOnly(data.onboarding),
      extension: openOnly(data.extension),
      offboarding: openOnly(data.offboarding),
      rate_change: openOnly(data.rateChange),
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
            {counts && t.key !== "activity" && (
              <span className={`ml-2 ${tab === t.key ? "text-slate-300" : "text-slate-400"}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        {tab !== "activity" && (
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
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, manager, country…"
          className="ml-auto w-full max-w-xs rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        {getExtraDefsFor(tab).length > 0 && (
          <ColumnsToggle
            defs={getExtraDefsFor(tab).map((d) => ({ key: d.key, label: d.label }))}
            hidden={hiddenColsByTab[tab] || new Set()}
            onToggle={(key) => toggleColVisibility(tab, key)}
          />
        )}
      </div>

      <section>
        {tab === "activity" ? (
          <ActivityLog search={search} reloadKey={activityReloadKey} />
        ) : tab === "sot" ? (
          <SotTable
            rows={sotPartitions.active}
            ownerFilter={ownerFilter}
            search={search}
            mode="active"
            pendingEndChange={pendingEndChange}
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
            hiddenCols={hiddenColsByTab[tab] || new Set()}
            onStatusChange={(entry, next) =>
              handleStatusChange(
                entry,
                next,
                setOverrides,
                setSotOverrides,
                setSotEndOverrides,
              )
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
    if (!o) return r;
    // Recompute closed too so an optimistic status flip moves the row between
    // the open and "completed" sections without waiting for a refresh.
    return { ...r, status: o, closed: isClosedStatus(r.source, o) };
  });
}

async function handleStatusChange(
  entry: RequestEntry,
  next: string,
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setSotOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setSotEndOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>,
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
    // Apply server-reported SoT side-effects optimistically so Active Roster
    // reflects the change without waiting for the next read-cache cycle.
    const body = (await res.json().catch(() => ({}))) as {
      sotSync?: { rowIndex: number; status: string } | null;
      sotEndSync?: { rowIndex: number; from: string | null; to: string } | null;
    };
    if (body.sotSync) {
      const sotKey = `sot:${body.sotSync.rowIndex}`;
      const status = body.sotSync.status;
      setSotOverrides((m) => ({ ...m, [sotKey]: status }));
    }
    if (body.sotEndSync) {
      const sotKey = `sot:${body.sotEndSync.rowIndex}`;
      const iso = body.sotEndSync.to;
      setSotEndOverrides((m) => ({ ...m, [sotKey]: iso }));
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
          Updated {new Date(fetchedAt).toLocaleString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
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
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          New view
        </a>
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

type RegionTag = "APAC" | "US" | "RoW" | "?";

/**
 * Derive a more specific region pill for display. Owner routing (apac vs row)
 * stays the same — Hemmi owns both US and RoW — but a US contractor gets a
 * "US" pill instead of "RoW" so the table doesn't mislabel them.
 */
function regionTagFor(owner: Owner, country: string | undefined | null): RegionTag {
  if (owner === "apac") return "APAC";
  if (owner === "unknown") return "?";
  const formatted = formatCountry(country);
  if (formatted.startsWith("US,") || /^united\s*states/i.test(country?.trim() || "")) {
    return "US";
  }
  return "RoW";
}

function urgencyBadge(workingDays: number | null): {
  label: string;
  tooltip: string;
  cls: string;
} | null {
  if (workingDays === null) return null;
  if (workingDays < 0) {
    const abs = Math.abs(workingDays);
    return {
      label: `${abs}d ago`,
      tooltip: `${abs} working day${abs === 1 ? "" : "s"} ago`,
      // "Past end date" is a different category from "ending soon" — render
      // in neutral dark slate so it doesn't compete with the red severity
      // signal used for upcoming end dates.
      cls: "bg-slate-800 text-white",
    };
  }
  if (workingDays <= 7) {
    return {
      label: `${workingDays}d left`,
      tooltip: `${workingDays} working day${workingDays === 1 ? "" : "s"} left`,
      cls: "bg-rose-100 text-rose-800",
    };
  }
  if (workingDays <= 14) {
    return {
      label: `${workingDays}d left`,
      tooltip: `${workingDays} working days left`,
      cls: "bg-amber-100 text-amber-800",
    };
  }
  return {
    label: `${workingDays}d left`,
    tooltip: `${workingDays} working days left`,
    cls: "bg-slate-100 text-slate-700",
  };
}

function matchesSearch(haystacks: (string | null | undefined)[], needle: string) {
  if (!needle.trim()) return true;
  const n = needle.toLowerCase();
  return haystacks.some((h) => (h || "").toLowerCase().includes(n));
}

/**
 * Best-effort display formatter for payment rate. The form is freeform, so
 * users type values like "$85/hr", "85 per hour", "32", "₩4,000,000/mo".
 * Rules:
 *   - If the value already contains a currency symbol, leave it alone.
 *   - If it's a bare number (e.g. "32"), prefix "$".
 *   - Append payment type ("Hourly" → "/hr", "Monthly" → "/mo") only if the
 *     rate doesn't already mention a period.
 */
/**
 * Whether a value is real content vs. an error / placeholder. Sheet errors
 * (`#N/A`, `#REF!`, etc.) shouldn't appear in subtitles or get joined into
 * a `· #N/A` string that wastes a row of vertical space.
 */
function isMeaningfulText(v: string | undefined | null): v is string {
  if (!v) return false;
  const trimmed = v.trim();
  if (!trimmed) return false;
  return !/^#(N\/A|REF!|VALUE!|NAME\?|DIV\/0!|NULL!|NUM!|ERROR!)/i.test(trimmed);
}

function formatPaymentRate(
  rate: string | undefined,
  paymentType?: string,
): string | undefined {
  if (!rate || !rate.trim()) return undefined;
  let display = rate.trim();
  const hasCurrency = /[$€£¥₩]/.test(display);
  const isBareNumber = /^[\d,]+(\.\d+)?$/.test(display);
  if (!hasCurrency && isBareNumber) {
    display = `$${display}`;
  }
  const hasPeriod = /\/(hr|hour|day|week|wk|month|mo|year|yr)/i.test(display) ||
    /per\s+(hour|day|week|month|year)/i.test(display);
  if (!hasPeriod && paymentType) {
    const t = paymentType.toLowerCase();
    if (t.includes("hour")) display += "/hr";
    else if (t.includes("month")) display += "/mo";
    else if (t.includes("project")) display += " (project)";
  }
  return display;
}

type ExtraDef = {
  key: string;
  label: string;
  pick: (r: RequestEntry) => string | undefined;
};

/**
 * Per-tab list of extra columns shown after the standard ones. Centralized
 * so the parent's Columns toggle and the table can share the same list.
 */
function getExtraDefsFor(tab: TabKey): ExtraDef[] {
  if (tab === "onboarding") {
    return [
      { key: "scope", label: "Scope", pick: (r) => r.scopeOfWork },
      { key: "paymentRate", label: "Payment rate", pick: (r) => formatPaymentRate(r.paymentRate, r.paymentType) },
      { key: "workingLocation", label: "Working location", pick: (r) => r.workingLocation },
      { key: "saasTools", label: "SaaS tools", pick: (r) => r.saasTools },
    ];
  }
  if (tab === "extension") {
    return [
      { key: "scope", label: "Scope", pick: (r) => r.scopeOfWork },
      { key: "paymentRate", label: "Payment rate", pick: (r) => formatPaymentRate(r.paymentRate, r.paymentType) },
      { key: "scopeOrRateChanged", label: "Scope/rate changed?", pick: (r) => r.scopeOrRateChanged },
    ];
  }
  if (tab === "offboarding") {
    return [
      { key: "reason", label: "Reason", pick: (r) => r.terminationReason },
      { key: "notified", label: "Notified?", pick: (r) => r.notifiedFlag },
    ];
  }
  if (tab === "rate_change") {
    return [{ key: "newPaymentRate", label: "New payment rate", pick: (r) => formatPaymentRate(r.newPaymentRate) }];
  }
  return [];
}

// --- Table primitives ---------------------------------------------------

type SortDir = "asc" | "desc";
type SortState<K extends string> = { col: K; dir: SortDir };

const PAGE_SIZE = 20;

/**
 * Infinite-scroll pagination hook. Returns `visibleCount` (start at PAGE_SIZE)
 * and a `sentinelRef` to attach to the last visible row. When the sentinel
 * scrolls into view, visibleCount bumps by PAGE_SIZE. Resets to PAGE_SIZE
 * whenever `resetKey` changes (e.g. user changes search or filter).
 */
function useInfiniteScroll(totalRows: number, resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [resetKey]);

  useEffect(() => {
    if (visibleCount >= totalRows) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, totalRows));
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, totalRows]);

  return { visibleCount: Math.min(visibleCount, totalRows), sentinelRef };
}

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
      className={`sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 ${
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

function OwnerPill({ owner, country }: { owner: Owner; country?: string }) {
  const tag = regionTagFor(owner, country);
  // US contractors share Hemmi's bucket with RoW, but get their own pill
  // color (amber) so the table doesn't read all-blue for the whole US team.
  const cls =
    tag === "APAC"
      ? "bg-emerald-100 text-emerald-800"
      : tag === "US"
        ? "bg-amber-100 text-amber-800"
        : tag === "RoW"
          ? "bg-sky-100 text-sky-800"
          : "bg-slate-100 text-slate-500";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
      title={ownerLabel(owner)}
    >
      {tag}
    </span>
  );
}

function UrgencyCell({ workingDays }: { workingDays: number | null }) {
  const badge = urgencyBadge(workingDays);
  if (!badge) return <span className="text-slate-400">—</span>;
  return (
    <span
      title={badge.tooltip}
      className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
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
  | "start"
  | "end"
  | "owner"
  | "status";

function SotTable({
  rows,
  ownerFilter,
  search,
  mode,
  pendingEndChange,
  onStatusChange,
}: {
  rows: SotEntry[];
  ownerFilter: Owner | "all";
  search: string;
  mode: "active" | "inactive";
  pendingEndChange?: Map<string, { proposedEnd: string; source: "extension" | "offboarding" }>;
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
      case "start":
        return compareDates(a.startDate, b.startDate) * dir;
      case "end":
        return compareDates(a.endDate, b.endDate) * dir;
    }
  });

  const { visibleCount, sentinelRef } = useInfiniteScroll(
    sorted.length,
    `${mode}|${ownerFilter}|${search}|${sort.col}|${sort.dir}`,
  );
  const paged = sorted.slice(0, visibleCount);

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
            {mode === "inactive" && (
              <HeaderCell label="Start" active={sort.col === "start"} dir={sort.dir} onClick={toggle("start")} />
            )}
            <HeaderCell label="End date (MM/DD)" active={sort.col === "end"} dir={sort.dir} onClick={toggle("end")} />
            {mode === "active" && (
              <th className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Urgency
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paged.map((r, idx) => {
            const isLast = idx === paged.length - 1;
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
              <tr
                key={`sot-${r.name}-${r.startDate ?? ""}-${r.endDate ?? ""}`}
                ref={isLast ? sentinelRef : null}
                className={rowTint}
              >
                <td className="px-3 py-2">
                  <div className={`max-w-[22ch] font-medium ${mode === "inactive" ? "text-slate-500" : "text-slate-900"}`}>
                    {r.name}
                  </div>
                  {(() => {
                    const parts = [r.jobTitle, r.department].filter(isMeaningfulText);
                    if (parts.length === 0) return null;
                    return (
                      <div className="text-xs text-slate-500">
                        <TruncatedCell
                          value={parts.join(" · ")}
                          label="Job title · Department"
                          maxCh={36}
                        />
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2"><OwnerPill owner={r.owner} country={r.country} /></td>
                <td className="px-3 py-2 text-slate-700">
                  <TruncatedCell value={formatCountry(r.country)} label="Country" maxCh={20} />
                </td>
                <td className="px-3 py-2 text-slate-700"><div className="max-w-[16ch]">{isMeaningfulText(r.manager) ? r.manager : "—"}</div></td>
                <td className="px-3 py-2 text-slate-700"><div className="max-w-[16ch]">{isMeaningfulText(r.approver) ? r.approver : "—"}</div></td>
                <td className="px-3 py-2">
                  <SotStatusSelect
                    entry={r}
                    onChange={(next) => onStatusChange(r, next)}
                  />
                </td>
                {mode === "inactive" && (
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {r.startDate ? fmtDate(new Date(r.startDate)) : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  {(() => {
                    if (!end) return "—";
                    const pending =
                      mode === "active"
                        ? pendingEndChange?.get(canonicalName(r.name))
                        : undefined;
                    if (pending) {
                      const proposed = new Date(pending.proposedEnd);
                      return (
                        <span
                          title={
                            pending.source === "extension"
                              ? "Pending extension"
                              : "Pending early offboarding"
                          }
                        >
                          <span className="text-slate-500 line-through">
                            {fmtDateShort(end)}
                          </span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span
                            className={
                              pending.source === "offboarding"
                                ? "font-medium text-red-700"
                                : "font-medium text-indigo-700"
                            }
                          >
                            {fmtDateShort(proposed)}
                          </span>
                        </span>
                      );
                    }
                    return mode === "active" ? fmtDateShort(end) : fmtDate(end);
                  })()}
                </td>
                {mode === "active" && (
                  <td className="px-3 py-2"><UrgencyCell workingDays={wd} /></td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {visibleCount < sorted.length && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          Showing {visibleCount} of {sorted.length} — scroll for more
        </div>
      )}
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
        className={`w-[130px] rounded-md border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 ${cls}`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "—"}
          </option>
        ))}
      </select>
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

type ReqSortCol = "flag" | "name" | "owner" | "country" | "manager" | "approver" | "status" | "date" | "requested";

function RequestTable({
  rows,
  ownerFilter,
  search,
  tab,
  hiddenCols,
  onStatusChange,
}: {
  rows: RequestEntry[];
  ownerFilter: Owner | "all";
  search: string;
  tab: TabKey;
  hiddenCols: Set<string>;
  onStatusChange: (entry: RequestEntry, next: string) => void;
}) {
  const [sort, setSort] = useState<SortState<ReqSortCol>>({
    col: "requested",
    dir: "desc", // newest request first
  });

  const filtered = rows.filter((r) => {
    if (ownerFilter !== "all" && r.owner !== ownerFilter) return false;
    return matchesSearch(
      [
        r.name,
        r.manager,
        r.approver,
        r.country,
        r.status,
        r.jobTitle,
        r.department,
        r.scopeOfWork,
        r.workingLocation,
        r.saasTools,
        r.terminationReason,
        r.newPaymentRate,
        r.paymentRate,
      ],
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
    // Closed rows (terminal status for the tab) always sink to the bottom,
    // regardless of the chosen sort column. Within each group the sort
    // column then takes over.
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
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
      case "requested": {
        // Most recent submission first when desc. Rows without a timestamp
        // (no matching Form Responses entry) sort to the bottom regardless of
        // direction so they don't crowd the top of the list.
        const ad = a.requestedAt ?? "";
        const bd = b.requestedAt ?? "";
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return ad.localeCompare(bd) * dir;
      }
    }
  });

  const openRows = sorted.filter((r) => !r.closed);
  const closedRows = sorted.filter((r) => r.closed);

  const [showClosed, setShowClosed] = useState(false);
  // Collapse closed rows whenever the user switches tab / filter / search /
  // sort — keeps the "looks busy" problem from coming back.
  useEffect(() => {
    setShowClosed(false);
  }, [tab, ownerFilter, search, sort.col, sort.dir]);

  const { visibleCount, sentinelRef } = useInfiniteScroll(
    openRows.length,
    `${tab}|${ownerFilter}|${search}|${sort.col}|${sort.dir}`,
  );
  const pagedOpen = openRows.slice(0, visibleCount);
  const visibleClosed = showClosed ? closedRows : [];

  if (sorted.length === 0) return <EmptyState />;

  const toggle = (col: ReqSortCol) => () =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "flag" ? "desc" : "asc" },
    );

  // Job Title + Department now live as a subtitle under the Name cell, so
  // they're not in the toggleable columns list anymore.
  const extraDefs = getExtraDefsFor(tab);

  const visibleExtras = extraDefs.filter((d) => !hiddenCols.has(d.key));

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
            <th className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Urgency
            </th>
            {visibleExtras.map((d) => (
              <th
                key={`xh-${d.key}`}
                className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pagedOpen.length === 0 && closedRows.length > 0 && (
            <tr>
              <td
                colSpan={9 + visibleExtras.length}
                className="px-3 py-6 text-center text-sm text-slate-400"
              >
                No open requests.
              </td>
            </tr>
          )}
          {pagedOpen.map((r, idx) =>
            renderRequestRow(r, idx === pagedOpen.length - 1 ? sentinelRef : null, {
              tab,
              visibleExtras,
              onStatusChange,
            }),
          )}
          {closedRows.length > 0 && (
            <tr>
              <td
                colSpan={9 + visibleExtras.length}
                className="border-y border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => setShowClosed((s) => !s)}
                  className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  <span className="inline-block w-3 text-slate-400">
                    {showClosed ? "▾" : "▸"}
                  </span>
                  {showClosed ? "Hide" : "Show"} {closedRows.length} completed
                  {" "}— reference only
                </button>
              </td>
            </tr>
          )}
          {visibleClosed.map((r) =>
            renderRequestRow(r, null, { tab, visibleExtras, onStatusChange }),
          )}
        </tbody>
      </table>
      {visibleCount < openRows.length && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          Showing {visibleCount} of {openRows.length} open — scroll for more
        </div>
      )}
    </div>
  );
}

/**
 * Render a single request row. Extracted so the open-rows list and the
 * (collapsed-by-default) closed-rows list can share the same markup. The
 * `sentinelRef` is passed only for the last open row so infinite scroll can
 * observe it.
 */
function renderRequestRow(
  r: RequestEntry,
  sentinelRef: React.Ref<HTMLTableRowElement> | null,
  ctx: {
    tab: TabKey;
    visibleExtras: ExtraDef[];
    onStatusChange: (entry: RequestEntry, next: string) => void;
  },
) {
  const { tab, visibleExtras, onStatusChange } = ctx;
  const dateFor = (e: RequestEntry): string | null => {
    if (tab === "onboarding") return e.startDate;
    if (tab === "extension") return e.priorEndDate;
    if (tab === "offboarding") return e.endDate;
    if (tab === "rate_change") return e.effectiveDate;
    return null;
  };
  const d = dateFor(r);
  const wd = d ? workingDaysUntil(new Date(d)) : null;
  const flagged = isFlagged(r.status);
  const sLower = r.status.trim().toLowerCase();
  const tint = r.closed
    ? "bg-slate-50/40 opacity-50 hover:opacity-100 hover:bg-slate-100/60"
    : sLower === "action required"
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
  const subtitleParts = [r.jobTitle, r.department].filter(isMeaningfulText);
  return (
    <tr key={`${r.source}-${r.rowIndex}`} ref={sentinelRef} className={tint}>
      <td className="px-2 py-2 text-center">
        {flagged ? (
          <span
            className={`inline-block h-2 w-2 rounded-full ${dotCls}`}
            title={r.status}
          />
        ) : null}
      </td>
      <td className="px-3 py-2">
        <div className="max-w-[22ch] font-medium text-slate-900">{r.name}</div>
        {subtitleParts.length > 0 && (
          <div className="text-xs text-slate-500">
            <TruncatedCell
              value={subtitleParts.join(" · ")}
              label="Job title · Department"
              maxCh={36}
            />
          </div>
        )}
      </td>
      <td className="px-3 py-2"><OwnerPill owner={r.owner} country={r.country} /></td>
      <td className="px-3 py-2 text-slate-700">
        <TruncatedCell value={formatCountry(r.country)} label="Country" maxCh={20} />
      </td>
      <td className="px-3 py-2 text-slate-700"><div className="max-w-[16ch]">{isMeaningfulText(r.manager) ? r.manager : "—"}</div></td>
      <td className="px-3 py-2 text-slate-700"><div className="max-w-[16ch]">{isMeaningfulText(r.approver) ? r.approver : "—"}</div></td>
      <td className="px-3 py-2">
        <StatusSelect
          entry={r}
          onChange={(next) => onStatusChange(r, next)}
        />
      </td>
      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
        {(() => {
          // For extension rows, only show the "prior → new" arrow when it
          // actually represents a forward extension (prior earlier than new).
          // Otherwise the arrow misleads — e.g. when priorEnd was captured
          // from a later, already-active extension for the same contractor.
          if (
            tab === "extension" &&
            r.priorEndDate &&
            r.newEndDate &&
            r.priorEndDate < r.newEndDate
          ) {
            return (
              <span>
                {fmtDate(new Date(r.priorEndDate))}
                <span className="mx-1 text-slate-400">→</span>
                {fmtDate(new Date(r.newEndDate))}
              </span>
            );
          }
          // Extension without a valid prior → just show the new end date.
          if (tab === "extension" && r.newEndDate) {
            return fmtDate(new Date(r.newEndDate));
          }
          return d ? fmtDate(new Date(d)) : "—";
        })()}
      </td>
      <td className="px-3 py-2"><UrgencyCell workingDays={wd} /></td>
      {visibleExtras.map((xd) => {
        const v = xd.pick(r);
        return (
          <td key={`x-${xd.key}`} className="px-3 py-2 text-slate-700">
            <TruncatedCell value={v} label={xd.label} />
          </td>
        );
      })}
    </tr>
  );
}

/**
 * A cell that truncates its text and reveals the full value in a popover on
 * click. Used for free-text columns (Scope, Reason, SaaS Tools, etc.) where
 * the value can be a paragraph but the table only has a few visible columns
 * of width. If the value fits in `maxCh`, renders as plain text with no
 * popover affordance.
 */
function TruncatedCell({
  value,
  maxCh = 22,
  label,
}: {
  value: string | undefined | null;
  maxCh?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Position the popover with fixed coordinates anchored to the button — the
  // surrounding table has overflow-x-auto, which would clip an absolutely-
  // positioned panel. Recompute on open + on scroll/resize so it tracks.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = 320;
      const viewportW = window.innerWidth;
      // Default: align left edge of panel under left edge of button.
      let left = rect.left;
      // Flip if it would overflow the right edge.
      if (left + panelWidth > viewportW - 8) {
        left = Math.max(8, viewportW - panelWidth - 8);
      }
      setPos({ top: rect.bottom + 4, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  if (!value || !value.trim()) {
    return <span className="text-slate-400">—</span>;
  }
  const v = value.trim();
  const isTruncated = v.length > maxCh;
  if (!isTruncated) {
    return <span className="whitespace-nowrap">{v}</span>;
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-full cursor-pointer items-center gap-0.5 align-middle text-left hover:text-slate-900 hover:underline hover:decoration-slate-400 hover:decoration-dotted hover:underline-offset-2"
        style={{ maxWidth: `${maxCh}ch` }}
        title="Click to expand"
      >
        <span className="truncate">{v.slice(0, maxCh)}…</span>
      </button>
      {open && pos && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed z-40 w-80 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {label && (
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </div>
            )}
            <div className="whitespace-pre-wrap break-words">{v}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  );
}

function ColumnsToggle({
  defs,
  hidden,
  onToggle,
}: {
  defs: { key: string; label: string }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hiddenCount = defs.filter((d) => hidden.has(d.key)).length;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="6" y1="3" x2="6" y2="13" />
          <line x1="10" y1="3" x2="10" y2="13" />
        </svg>
        Columns
        {hiddenCount > 0 && (
          <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
            {defs.length - hiddenCount}/{defs.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
            {defs.map((d) => {
              const isVisible = !hidden.has(d.key);
              return (
                <label
                  key={d.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(d.key)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">{d.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
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
      className={`w-[130px] rounded-md border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 ${chipClasses(current)}`}
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

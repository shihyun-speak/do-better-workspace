"use client";

import { useState } from "react";

// Manual status change: a dropdown with the Sheet's own values. Asks before
// writing, since it updates the real Sheet.
export default function StatusSelect({
  value,
  options,
  what,
  note,
  onChange,
}: {
  value: string;
  options: string[];
  what: string;
  note?: (next: string) => string;
  onChange: (next: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const has = options.some((o) => o.toLowerCase() === value.toLowerCase());
  const current = has ? options.find((o) => o.toLowerCase() === value.toLowerCase())! : value;
  return (
    <select
      className="statussel"
      value={current}
      disabled={busy}
      aria-label={`Status of ${what}`}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const next = e.target.value;
        const extra = note?.(next);
        if (!window.confirm(`Change ${what} from "${value || "No status"}" to "${next}" in the Sheet?${extra ? `\n\n${extra}` : ""}`)) return;
        setBusy(true);
        await onChange(next);
        setBusy(false);
      }}
    >
      {!has && <option value={value}>{value || "No status"}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

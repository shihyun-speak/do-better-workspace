"use client";

import { useMemo, useState } from "react";
import type { RequestSource } from "@/lib/parsers";
import { parseDate } from "@/lib/dates";

// One month calendar shared by every Open items tab (Shihyun, 2026-11-04):
// all four request types' key dates, colored by type. The current tab's dates
// are solid, the rest are softer. Click a day to list just that day.

export type CalKind = RequestSource | "contract";

export const DATE_KIND: Record<CalKind, string> = {
  onboarding: "Start",
  extension: "Current end",
  offboarding: "Last day",
  rate_change: "Rate effective",
  // Everyone still active in SoT with no extension / offboarding open
  // (Shihyun, 2026-11-04), so un-offboarded past end dates show up too.
  contract: "Contract end",
};

export type CalWho = { name: string; owner: string; country: string };
export type CalEvent = { key: string; kind: CalKind; date: Date; who: CalWho };

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const short = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export default function DateCalendar({
  events,
  tab,
  renderWho,
}: {
  events: CalEvent[];
  tab: RequestSource;
  renderWho: (w: CalWho) => React.ReactNode;
}) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const [ym, setYm] = useState<[number, number]>([today.getUTCFullYear(), today.getUTCMonth()]);
  const [picked, setPicked] = useState<string | null>(null);
  const [y, m] = ym;

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of [...events].sort((a, b) => a.date.getTime() - b.date.getTime())) {
      const k = dayKey(e.date);
      map.set(k, [...(map.get(k) || []), e]);
    }
    return map;
  }, [events]);

  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m, i + 1))),
  ];

  const inMonth = events
    .filter((e) => e.date.getUTCFullYear() === y && e.date.getUTCMonth() === m)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const shown = picked ? byDay.get(picked) || [] : inMonth;
  const earlier = events.filter((e) => e.date < first);
  const later = events.filter((e) => e.date > new Date(Date.UTC(y, m + 1, 0)));
  const next = later.sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const go = (d: Date) => {
    setYm([d.getUTCFullYear(), d.getUTCMonth()]);
    setPicked(null);
  };
  const shift = (n: number) => go(new Date(Date.UTC(y, m + n, 1)));

  return (
    <section className={`panel cal t-${tab}`}>
      <div className="calhead">
        <h2>{monthLabel(y, m)}</h2>
        <div className="calnav">
          <button type="button" className="btn ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button type="button" className="btn ghost" onClick={() => go(today)}>Today</button>
          <button type="button" className="btn ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="calgrid" role="grid">
        {DOW.map((d, i) => (
          <span key={i} className="caldow">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const k = dayKey(d);
          const evs = byDay.get(k) || [];
          const cls = [
            "calday",
            k === dayKey(today) ? "today" : "",
            picked === k ? "picked" : "",
            evs.length ? "has" : "",
          ].join(" ");
          return (
            <button
              key={k}
              type="button"
              className={cls}
              disabled={!evs.length}
              onClick={() => setPicked(picked === k ? null : k)}
              title={evs.map((e) => `${e.who.name}: ${DATE_KIND[e.kind]}`).join("\n")}
            >
              {d.getUTCDate()}
              <span className="dots">
                {evs.slice(0, 4).map((e) => (
                  <i key={e.key} className={`t-${e.kind} ${e.kind === tab ? "" : "soft"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="callegend">
        {(Object.keys(DATE_KIND) as CalKind[]).map((s) => (
          <span key={s} className={`t-${s} ${s === tab ? "" : "soft"}`}><i />{DATE_KIND[s]}</span>
        ))}
      </div>
      <div className="callisthead">
        <span>{picked ? short(new Date(picked)) : `In ${monthLabel(y, m).split(" ")[0]}`}</span>
        {picked && (
          <button type="button" className="linkbtn" onClick={() => setPicked(null)}>Show whole month</button>
        )}
      </div>
      <ul className="tl">
        {shown.length ? (
          shown.map((e) => (
            <li key={e.key} className={`tlrow t-${e.kind} ${e.kind === tab ? "" : "other"}`}>
              <div className="tldate">
                <b>{e.date.getUTCDate()}</b>
                {e.date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" })}
              </div>
              <div className="who">
                {renderWho(e.who)}
                <span className="pill type">{DATE_KIND[e.kind]}</span>
              </div>
            </li>
          ))
        ) : (
          <li className="empty">Nothing this month.</li>
        )}
      </ul>
      {!picked && (earlier.length > 0 || next) && (
        <div className="calmore">
          {earlier.length > 0 && (
            <button type="button" className="linkbtn" onClick={() => go(earlier.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date)}>
              ‹ {earlier.length} earlier
            </button>
          )}
          {next && (
            <button type="button" className="linkbtn" onClick={() => go(next.date)}>
              Next: {short(next.date)} ›
            </button>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { UPDATES } from "@/lib/updates";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

export default function Updates() {
  const days = [...new Set(UPDATES.map((u) => u.date))];
  return (
    <>
      <div className="pagehead">
        <h1>What&apos;s new</h1>
        <p className="sub">Changes to the dashboard, newest first. Ideas or something off? Post in #global-contractor-dashboard.</p>
      </div>
      <div className="updates">
        {days.map((d) => (
          <section key={d} className="upday">
            <h2>{fmt(d)}</h2>
            <ul>
              {UPDATES.filter((u) => u.date === d).map((u) => (
                <li key={u.title} className="upitem">
                  <span className={`upkind k-${u.kind.toLowerCase()}`}>{u.kind}</span>
                  <div>
                    <b>{u.title}</b>
                    <p>{u.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

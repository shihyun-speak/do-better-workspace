import { NextResponse } from "next/server";
import { reconcileSotStatus } from "@/lib/reconcile";
import { appendLog } from "@/lib/activityLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AUTOMATION = "SoT status sync";

/**
 * Daily SoT col H reconciler, triggered by Vercel cron. Vercel sets the
 * `Authorization: Bearer ${CRON_SECRET}` header on cron invocations — we
 * verify it so this endpoint can't be hit by random callers.
 *
 * Schedule lives in vercel.json. Each real run is written to the automation
 * log (Activity tab): one summary row + one row per flipped / failed contractor.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  try {
    const result = await reconcileSotStatus({ dryRun });
    if (!dryRun) {
      await appendLog([
        {
          automation: AUTOMATION,
          flow: "Contractor",
          trigger: "Schedule",
          person: "",
          action: `Run: ${result.flipped.length} updated, ${result.errors.length} failed`,
          result: result.errors.length ? "Failed" : "OK",
          details: `Scanned ${result.scanned} SoT rows`,
        },
        ...result.flipped.map((f) => ({
          automation: AUTOMATION,
          flow: "Contractor",
          trigger: "Schedule",
          person: f.name,
          action: `SoT status: ${f.from} → ${f.to}`,
          result: "OK" as const,
          details: `Row ${f.rowIndex}`,
        })),
        ...result.errors.map((e) => ({
          automation: AUTOMATION,
          flow: "Contractor",
          trigger: "Schedule",
          person: e.name,
          action: "SoT status write failed",
          result: "Failed" as const,
          details: `Row ${e.rowIndex}: ${e.message}`,
        })),
      ]);
    }
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!dryRun) {
      await appendLog([
        {
          automation: AUTOMATION,
          flow: "Contractor",
          trigger: "Schedule",
          person: "",
          action: "Run crashed",
          result: "Failed",
          details: message,
        },
      ]);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

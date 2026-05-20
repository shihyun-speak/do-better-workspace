import { NextResponse } from "next/server";
import { reconcileSotStatus } from "@/lib/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily SoT col H reconciler, triggered by Vercel cron. Vercel sets the
 * `Authorization: Bearer ${CRON_SECRET}` header on cron invocations — we
 * verify it so this endpoint can't be hit by random callers.
 *
 * Schedule lives in vercel.json. Returns the list of flipped rows so the
 * Vercel cron log is itself the audit trail.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileSotStatus();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

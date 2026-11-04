import { NextResponse } from "next/server";
import { activityLogEnabled, readLog } from "@/lib/activityLog";

export const dynamic = "force-dynamic";

// Session-gated by middleware like every other /api route.
export async function GET() {
  if (!activityLogEnabled()) {
    return NextResponse.json({ enabled: false, entries: [] });
  }
  try {
    const entries = await readLog(500);
    return NextResponse.json({ enabled: true, entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

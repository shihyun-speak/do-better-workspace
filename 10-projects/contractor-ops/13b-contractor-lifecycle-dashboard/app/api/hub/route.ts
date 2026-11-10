import { NextResponse } from "next/server";
import { loadAll } from "@/lib/parsers";
import { readSteps } from "@/lib/steps";

// Live data for the Contractor Hub (2026-11-10): the page polls this every
// 30s while the tab is visible, so edits made directly in the Sheet show up
// without a reload. Always fresh, never cached.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [data, steps] = await Promise.all([loadAll(), readSteps()]);
    return NextResponse.json({ data, steps }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

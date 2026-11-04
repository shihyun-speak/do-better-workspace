import { NextResponse } from "next/server";
import { loadSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

// Session-gated by middleware like every other /api route.
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  try {
    return NextResponse.json({ submissions: await loadSubmissions(name) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

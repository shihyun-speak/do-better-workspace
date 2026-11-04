import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CHANGED_CHOICE, PLANS } from "@/lib/plans";
import { readSteps, writeStep } from "@/lib/steps";
import type { RequestSource } from "@/lib/parsers";

export const dynamic = "force-dynamic";

// Session-gated by middleware like every other /api route.
export async function GET() {
  try {
    return NextResponse.json({ steps: await readSteps() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { key?: string; type?: RequestSource; contractor?: string; step?: string; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { key, type, contractor, step, done } = body;
  if (!type || !PLANS[type]) {
    return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
  }
  const isChoice = type === "extension" && step === CHANGED_CHOICE;
  if (!step || (!isChoice && !PLANS[type].steps.some((s) => s.id === step))) {
    return NextResponse.json({ error: `Unknown step for ${type}` }, { status: 400 });
  }
  if (!key || !key.startsWith(`${type}:`) || typeof done !== "boolean" || !contractor) {
    return NextResponse.json({ error: "Missing key, contractor or done" }, { status: 400 });
  }
  const session = await auth();
  try {
    await writeStep({ key, type, contractor, step, done, by: session?.user?.email || "unknown" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST() {
  revalidatePath("/");
  revalidatePath("/api/contractors");
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

import { NextResponse } from "next/server";
import { loadAll } from "@/lib/parsers";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await loadAll();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { dbStatus } from "@/lib/db";

// Open /api/health on any deployment to see which database is used and whether it works.
// Never returns the password.
export async function GET() {
  const s = await dbStatus();
  return NextResponse.json(s, { status: s.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}

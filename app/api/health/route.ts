import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = !!process.env.DATABASE_URL;
  let host: string | null = null;
  try {
    host = hasUrl ? new URL(process.env.DATABASE_URL!).host : null;
  } catch {
    host = "INVALID URL FORMAT (special chars in password?)";
  }
  try {
    const r = await q<{ n: number }>("select count(*)::int as n from tb.demo_users");
    return NextResponse.json({ ok: true, hasUrl, host, users: r[0]?.n });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      hasUrl,
      host,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

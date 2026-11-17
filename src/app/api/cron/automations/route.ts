import { NextResponse, type NextRequest } from "next/server";
import { runAutomations } from "@/lib/automations/worker";

/**
 * Sends due automation messages. Call every 5 minutes with:  Authorization: Bearer <CRON_SECRET>
 * (Supabase pg_cron + pg_net, Vercel Cron, or any uptime/cron service). See README → Automations.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET in the environment first." }, { status: 503 });
  const header = request.headers.get("authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : request.nextUrl.searchParams.get("secret");
  if (given !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ ok: true, ...(await runAutomations()) });
  } catch (err) {
    console.error("Automations run failed", err);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

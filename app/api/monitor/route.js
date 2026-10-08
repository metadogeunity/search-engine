import { NextResponse } from "next/server";
import { TERMS } from "@/lib/config";
import { collectAll } from "@/lib/trends";
import { getLatestSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getLatestSnapshot();
  const fresh = await collectAll(TERMS);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "google-trends",
    terms: fresh
  };

  return NextResponse.json({
    ...snapshot,
    historyAvailable: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    lastPersistedAt: stored?.generatedAt || null
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

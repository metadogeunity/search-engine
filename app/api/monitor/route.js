import { NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getLatestSnapshot();

  if (!stored) {
    return NextResponse.json({
      generatedAt: null,
      source: "waiting-for-collector",
      terms: [],
      historyAvailable: Boolean(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ),
      message: "Waiting for the first scheduled collection."
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  return NextResponse.json({
    ...stored,
    historyAvailable: Boolean(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ),
    lastPersistedAt: stored.generatedAt
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

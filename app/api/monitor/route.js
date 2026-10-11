import { NextResponse } from "next/server";
import { getDailyHistory, getLatestSnapshot } from "@/lib/store";
import { TERMS } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyTerms() {
  return TERMS.map((term) => ({
    ...term,
    score: 0,
    delta: 0,
    sampledPoints: 0,
    estimatedDaily: null
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedDays = Number(searchParams.get("days") || "30");
  const days = Math.min(
    Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1),
    365
  );

  const [stored, dailyHistory] = await Promise.all([
    getLatestSnapshot(),
    getDailyHistory(days)
  ]);

  const historyAvailable = Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (!stored) {
    return NextResponse.json({
      generatedAt: null,
      source: "waiting-for-collector",
      region: "Karnataka",
      geo: "IN-KA",
      terms: emptyTerms(),
      dailyHistory,
      historyAvailable,
      message: "Waiting for the first scheduled collection."
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  return NextResponse.json({
    ...stored,
    dailyHistory,
    historyAvailable,
    lastPersistedAt: stored.generatedAt
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

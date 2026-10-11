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

function normalizeStoredSnapshot(stored) {
  const storedById = new Map(
    Array.isArray(stored?.terms)
      ? stored.terms.map((term) => [term.id, term])
      : []
  );

  return {
    ...stored,
    region: "Karnataka",
    geo: "IN-KA",
    terms: TERMS.map((term) => {
      const previous = storedById.get(term.id);
      return {
        ...term,
        score: Number(previous?.score) || 0,
        delta: Number(previous?.delta) || 0,
        sampledPoints: Number(previous?.sampledPoints) || 0,
        estimatedDaily: previous?.estimatedDaily ?? null,
        ...(previous?.error ? { error: previous.error } : {})
      };
    })
  };
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
    ...normalizeStoredSnapshot(stored),
    dailyHistory,
    historyAvailable,
    lastPersistedAt: stored.generatedAt
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

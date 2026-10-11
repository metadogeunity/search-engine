import { NextResponse } from "next/server";
import { getCumulativeTotals, getDailyHistory, getLatestSnapshot } from "@/lib/store";
import { TERMS } from "@/lib/config";
import { getRegion } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyTerms(region, cumulativeTotals = {}) {
  return TERMS.map((term) => ({
    ...term,
    region: region.label,
    geo: region.geo,
    score: 0,
    delta: 0,
    sampledPoints: 0,
    estimatedDaily: null,
    cumulativeInterest: Number(cumulativeTotals[term.id]) || 0
  }));
}

function normalizeStoredSnapshot(stored, region, cumulativeTotals = {}) {
  const storedById = new Map(
    Array.isArray(stored?.terms)
      ? stored.terms.map((term) => [term.id, term])
      : []
  );

  return {
    ...stored,
    region: region.label,
    geo: region.geo,
    terms: TERMS.map((term) => {
      const previous = storedById.get(term.id);
      return {
        ...term,
        region: region.label,
        geo: region.geo,
        score: Number(previous?.score) || 0,
        delta: Number(previous?.delta) || 0,
        sampledPoints: Number(previous?.sampledPoints) || 0,
        estimatedDaily: previous?.estimatedDaily ?? null,
        cumulativeInterest: Number(cumulativeTotals[term.id]) || 0,
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

  const region = getRegion(searchParams.get("region") || "karnataka");

  const [stored, dailyHistory, cumulativeTotals] = await Promise.all([
    getLatestSnapshot(region.id),
    getDailyHistory(days, region.id),
    getCumulativeTotals(region.id)
  ]);

  const totalCumulativeInterest = TERMS.reduce(
    (sum, term) => sum + (Number(cumulativeTotals[term.id]) || 0),
    0
  );

  const historyAvailable = Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (!stored) {
    return NextResponse.json({
      generatedAt: null,
      source: "waiting-for-collector",
      region: region.label,
      geo: region.geo,
      terms: emptyTerms(region, cumulativeTotals),
      cumulativeInterest: totalCumulativeInterest,
      dailyHistory,
      historyAvailable,
      message: "Waiting for the first scheduled collection for this region."
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  return NextResponse.json({
    ...normalizeStoredSnapshot(stored, region, cumulativeTotals),
    cumulativeInterest: totalCumulativeInterest,
    dailyHistory,
    historyAvailable,
    lastPersistedAt: stored.generatedAt
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

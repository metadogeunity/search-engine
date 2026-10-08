import trends from "google-trends-api";
import { configuredBaseline } from "./config";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTrendResponse(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const timeline = parsed?.default?.timelineData || [];
  return timeline.map((row) => {
    const value = Array.isArray(row.value) ? row.value[0] : row.value;
    return { time: Number(row.time) * 1000, value: safeNumber(value) };
  }).filter((x) => Number.isFinite(x.time));
}

function calculateDelta(points) {
  if (points.length < 2) return 0;
  const current = points.at(-1).value;
  const previous = points.at(-2).value;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function estimateDaily(term, score) {
  const monthly = configuredBaseline(term);
  if (!monthly || !score) return null;
  return Math.round((monthly / 30) * (score / 100));
}

export async function collectTerm(term) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const raw = await trends.interestOverTime({
    keyword: term.keyword,
    startTime,
    endTime,
    geo: "IN",
    hl: "en-IN",
    timezone: -330,
    granularTimeResolution: true
  });

  const points = parseTrendResponse(raw);
  const recent = points.slice(-4);
  const score = recent.length ? recent.reduce((sum, point) => sum + point.value, 0) / recent.length : 0;

  return {
    ...term,
    score: Math.round(score),
    delta: calculateDelta(points),
    sampledPoints: points.length,
    estimatedDaily: estimateDaily(term, score)
  };
}

export async function collectAll(terms) {
  const results = [];
  for (const term of terms) {
    try {
      results.push(await collectTerm(term));
    } catch (error) {
      results.push({
        ...term,
        score: 0,
        delta: 0,
        sampledPoints: 0,
        estimatedDaily: null,
        error: error instanceof Error ? error.message : "Trend provider error"
      });
    }
  }
  return results;
}

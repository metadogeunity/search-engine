import trends from "google-trends-api";
import { Redis } from "@upstash/redis";

const terms = [
  { id: "gst-registration", label: "GST Registration", keyword: "gst registration" },
  { id: "gst-registration-bangalore", label: "GST Registration Bangalore", keyword: "gst registration bangalore" },
  { id: "company-registration", label: "Company Registration", keyword: "company registration" },
  { id: "company-registration-bangalore", label: "Company Registration Bangalore", keyword: "company registration bangalore" },
  { id: "private-limited-company-registration", label: "Private Limited Company Registration", keyword: "private limited company registration" },
  { id: "llp-registration-bangalore", label: "LLP Registration Bangalore", keyword: "llp registration bangalore" }
];

function parseTrendResponse(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const timeline = parsed?.default?.timelineData || [];
  return timeline.map((row) => {
    const value = Array.isArray(row.value) ? row.value[0] : row.value;
    return { time: Number(row.time) * 1000, value: Number(value) || 0 };
  });
}

async function collectTerm(term) {
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
  const score = recent.length
    ? recent.reduce((sum, point) => sum + point.value, 0) / recent.length
    : 0;

  const current = points.at(-1)?.value || 0;
  const previous = points.at(-2)?.value || 0;
  const delta = previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);

  return {
    ...term,
    score: Math.round(score),
    delta,
    sampledPoints: points.length
  };
}

async function main() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  }

  const redis = Redis.fromEnv();
  const results = [];

  for (const term of terms) {
    try {
      results.push(await collectTerm(term));
      console.log(`Collected: ${term.keyword}`);
    } catch (error) {
      results.push({
        ...term,
        score: 0,
        delta: 0,
        sampledPoints: 0,
        error: error instanceof Error ? error.message : "Trend provider error"
      });
      console.error(`Failed: ${term.keyword}`, error);
    }
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "google-trends",
    terms: results
  };

  await redis.set("search-intent-monitor:latest", snapshot);
  await redis.lpush("search-intent-monitor:history", JSON.stringify(snapshot));
  await redis.ltrim("search-intent-monitor:history", 0, 287);

  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

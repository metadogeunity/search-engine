import trends from "google-trends-api";
import { Redis } from "@upstash/redis";
import { TERMS } from "../lib/config.js";

const terms = TERMS;
const GEO = "IN-KA";
const CONCURRENCY = Math.max(1, Number(process.env.COLLECT_CONCURRENCY || "5"));

const loops = Math.max(1, Number(process.env.COLLECT_LOOPS || "1"));
const intervalSeconds = Math.max(60, Number(process.env.COLLECT_INTERVAL_SECONDS || "60"));

const LATEST_KEY = "search-intent-monitor:latest";
const HISTORY_KEY = "search-intent-monitor:history";
const DAILY_PREFIX = "search-intent-monitor:daily:";
const DAILY_MIGRATION_KEY = "search-intent-monitor:daily-migration-v1";
const CUMULATIVE_KEY = "search-intent-monitor:cumulative";
const CUMULATIVE_MIGRATION_KEY = "search-intent-monitor:cumulative-migration-v1";
const DAILY_TTL_SECONDS = 60 * 60 * 24 * 365;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTrendResponse(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const timeline = parsed?.default?.timelineData || [];

  return timeline.map((row) => {
    const value = Array.isArray(row.value) ? row.value[0] : row.value;
    return {
      time: Number(row.time) * 1000,
      value: Number(value) || 0
    };
  });
}

function indiaDateKey(date = new Date()) {
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function createDailyBucket(date) {
  return {
    date,
    sampleCount: 0,
    lastUpdatedAt: null,
    terms: {}
  };
}

function mergeSnapshotIntoBucket(bucket, snapshot) {
  bucket.sampleCount += 1;
  bucket.lastUpdatedAt = latestDate(bucket.lastUpdatedAt, snapshot.generatedAt);

  for (const term of snapshot.terms || []) {
    if (
      !Number.isFinite(Number(term.score)) ||
      Number(term.sampledPoints || 0) <= 0 ||
      term.error
    ) {
      continue;
    }

    const score = Number(term.score) || 0;
    const previous = bucket.terms[term.id] || {
      sum: 0,
      count: 0,
      average: 0,
      latest: 0,
      min: 100,
      max: 0
    };

    previous.sum += score;
    previous.count += 1;
    previous.average = Math.round(previous.sum / previous.count);
    previous.latest = Math.round(score);
    previous.min = Math.min(previous.min, score);
    previous.max = Math.max(previous.max, score);

    bucket.terms[term.id] = previous;
  }

  return bucket;
}

function latestDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

async function persistDailySnapshot(redis, snapshot) {
  const date = indiaDateKey(new Date(snapshot.generatedAt || Date.now()));
  const key = DAILY_PREFIX + date;
  const existing = await redis.get(key);
  const bucket = existing && typeof existing === "object"
    ? existing
    : createDailyBucket(date);

  mergeSnapshotIntoBucket(bucket, snapshot);
  await redis.set(key, bucket, { ex: DAILY_TTL_SECONDS });
}

async function migrateExistingHistory(redis) {
  if (await redis.get(DAILY_MIGRATION_KEY)) return;

  const rawHistory = await redis.lrange(HISTORY_KEY, 0, 287);
  const buckets = new Map();

  for (const item of rawHistory) {
    try {
      const snapshot = typeof item === "string" ? JSON.parse(item) : item;
      if (!snapshot?.generatedAt || !Array.isArray(snapshot?.terms)) continue;

      const date = indiaDateKey(new Date(snapshot.generatedAt));
      const bucket = buckets.get(date) || createDailyBucket(date);
      buckets.set(date, mergeSnapshotIntoBucket(bucket, snapshot));
    } catch (error) {
      console.error("History migration skipped malformed snapshot:", error);
    }
  }

  for (const [date, incoming] of buckets) {
    const key = DAILY_PREFIX + date;
    const existing = await redis.get(key);

    if (existing && typeof existing === "object") {
      const merged = existing;

      merged.sampleCount = Number(merged.sampleCount || 0) + Number(incoming.sampleCount || 0);
      merged.lastUpdatedAt = latestDate(merged.lastUpdatedAt, incoming.lastUpdatedAt);

      for (const [termId, incomingTerm] of Object.entries(incoming.terms || {})) {
        const current = merged.terms?.[termId];

        if (!current) {
          merged.terms = merged.terms || {};
          merged.terms[termId] = incomingTerm;
          continue;
        }

        current.sum = Number(current.sum || 0) + Number(incomingTerm.sum || 0);
        current.count = Number(current.count || 0) + Number(incomingTerm.count || 0);
        current.average = current.count ? Math.round(current.sum / current.count) : 0;
        current.latest = incomingTerm.latest;
        current.min = Math.min(Number(current.min ?? 100), Number(incomingTerm.min ?? 100));
        current.max = Math.max(Number(current.max ?? 0), Number(incomingTerm.max ?? 0));
      }

      await redis.set(key, merged, { ex: DAILY_TTL_SECONDS });
    } else {
      await redis.set(key, incoming, { ex: DAILY_TTL_SECONDS });
    }
  }

  await redis.set(DAILY_MIGRATION_KEY, new Date().toISOString(), { ex: DAILY_TTL_SECONDS });
  console.log("Daily history migration completed");
}

async function migrateCumulativeTotals(redis) {
  if (await redis.get(CUMULATIVE_MIGRATION_KEY)) return;

  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(Date.now() + 330 * 60 * 1000 - offset * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const bucket = await redis.get(DAILY_PREFIX + date);
    if (!bucket?.terms) continue;

    const increments = Object.entries(bucket.terms)
      .map(([termId, data]) => [termId, Math.round(Number(data?.sum) || 0)])
      .filter(([, amount]) => amount > 0);

    if (increments.length) {
      await Promise.all(
        increments.map(([termId, amount]) => redis.hincrby(CUMULATIVE_KEY, termId, amount))
      );
    }
  }

  await redis.set(CUMULATIVE_MIGRATION_KEY, new Date().toISOString());
  console.log("Cumulative totals migration completed");
}

async function incrementCumulativeTotals(redis, snapshot) {
  const increments = (snapshot.terms || [])
    .filter((term) => Number(term.sampledPoints || 0) > 0 && !term.error)
    .map((term) => [term.id, Math.round(Number(term.score) || 0)])
    .filter(([, amount]) => amount > 0);

  if (!increments.length) return;

  await Promise.all(
    increments.map(([termId, amount]) => redis.hincrby(CUMULATIVE_KEY, termId, amount))
  );
}

async function collectTerm(term) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const raw = await trends.interestOverTime({
    keyword: term.keyword,
    startTime,
    endTime,
    geo: GEO,
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
  const delta = previous === 0
    ? (current === 0 ? 0 : 100)
    : Math.round(((current - previous) / previous) * 100);

  return {
    ...term,
    score: Math.round(score),
    delta,
    sampledPoints: points.length
  };
}

async function collectSnapshot(redis) {
  const results = [];

  for (let index = 0; index < terms.length; index += CONCURRENCY) {
    const batch = terms.slice(index, index + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (term) => {
      try {
        const result = await collectTerm(term);
        console.log("Collected:", term.keyword);
        return result;
      } catch (error) {
        console.error("Failed:", term.keyword, error);
        return {
          ...term,
          score: 0,
          delta: 0,
          sampledPoints: 0,
          error: error instanceof Error ? error.message : "Trend provider error"
        };
      }
    }));
    
    results.push(...batchResults);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "google-trends",
    region: "Karnataka",
    geo: GEO,
    terms: results
  };

  await redis.set(LATEST_KEY, snapshot);
  await redis.lpush(HISTORY_KEY, JSON.stringify(snapshot));
  await redis.ltrim(HISTORY_KEY, 0, 2879);
  await persistDailySnapshot(redis, snapshot);
  await incrementCumulativeTotals(redis, snapshot);

  console.log("Snapshot saved at", snapshot.generatedAt);
}

async function main() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  }

  const redis = Redis.fromEnv();

  await migrateExistingHistory(redis);
  await migrateCumulativeTotals(redis);

  for (let i = 0; i < loops; i += 1) {
    const iterationStarted = Date.now();
    console.log("Collection", i + 1, "of", loops);

    await collectSnapshot(redis);

    if (i < loops - 1) {
      const elapsed = Date.now() - iterationStarted;
      const remaining = Math.max(0, intervalSeconds * 1000 - elapsed);
      console.log("Waiting", Math.ceil(remaining / 1000), "seconds until next collection");
      await sleep(remaining);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { Redis } from "@upstash/redis";

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

const LATEST_KEY = "search-intent-monitor:latest";
const HISTORY_KEY = "search-intent-monitor:history";

export async function saveSnapshot(snapshot) {
  const redis = getRedis();
  if (!redis) return { persisted: false };
  await redis.set(LATEST_KEY, snapshot);
  await redis.lpush(HISTORY_KEY, JSON.stringify(snapshot));
  await redis.ltrim(HISTORY_KEY, 0, 287);
  return { persisted: true };
}

export async function getLatestSnapshot() {
  const redis = getRedis();
  if (!redis) return null;
  return await redis.get(LATEST_KEY);
}

export async function getHistory(limit = 48) {
  const redis = getRedis();
  if (!redis) return [];
  return await redis.lrange(HISTORY_KEY, 0, Math.max(0, limit - 1));
}

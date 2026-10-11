import { Redis } from "@upstash/redis";

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

const LATEST_KEY = "search-intent-monitor:latest";
const HISTORY_KEY = "search-intent-monitor:history";
const DAILY_PREFIX = "search-intent-monitor:daily:";

export async function saveSnapshot(snapshot) {
  const redis = getRedis();
  if (!redis) return { persisted: false };
  await redis.set(LATEST_KEY, snapshot);
  await redis.lpush(HISTORY_KEY, JSON.stringify(snapshot));
  await redis.ltrim(HISTORY_KEY, 0, 2879);
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

export async function getDailyHistory(days = 30) {
  const redis = getRedis();
  if (!redis) return [];

  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const keys = [];

  for (let offset = 0; offset < safeDays; offset += 1) {
    const date = new Date(Date.now() + 330 * 60 * 1000 - offset * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    keys.push(DAILY_PREFIX + date);
  }

  const values = await Promise.all(keys.map((key) => redis.get(key)));

  return values
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

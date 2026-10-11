import { Redis } from "@upstash/redis";
import { getRegion } from "@/lib/regions";

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

function getKeys(regionId = "karnataka") {
  return getRegion(regionId).keys;
}

export async function saveSnapshot(snapshot, regionId = "karnataka") {
  const redis = getRedis();
  if (!redis) return { persisted: false };

  const keys = getKeys(regionId);
  await redis.set(keys.latest, snapshot);
  await redis.lpush(keys.history, JSON.stringify(snapshot));
  await redis.ltrim(keys.history, 0, 2879);
  return { persisted: true };
}

export async function getLatestSnapshot(regionId = "karnataka") {
  const redis = getRedis();
  if (!redis) return null;
  return await redis.get(getKeys(regionId).latest);
}

export async function getHistory(limit = 48, regionId = "karnataka") {
  const redis = getRedis();
  if (!redis) return [];
  const keys = getKeys(regionId);
  return await redis.lrange(keys.history, 0, Math.max(0, limit - 1));
}

export async function getCumulativeTotals(regionId = "karnataka") {
  const redis = getRedis();
  if (!redis) return {};
  return (await redis.hgetall(getKeys(regionId).cumulative)) || {};
}

export async function getDailyHistory(days = 30, regionId = "karnataka") {
  const redis = getRedis();
  if (!redis) return [];

  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const { dailyPrefix } = getKeys(regionId);
  const keys = [];

  for (let offset = 0; offset < safeDays; offset += 1) {
    const date = new Date(Date.now() + 330 * 60 * 1000 - offset * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    keys.push(dailyPrefix + date);
  }

  const values = await Promise.all(keys.map((key) => redis.get(key)));

  return values
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

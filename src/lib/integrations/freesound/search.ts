import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CommandError } from "@/lib/services/command-error";
import { freesoundClient } from "./runtime";

const buckets = new Map<string, { start: number; used: number }>();
const cache = new Map<string, { expires: number; data: Awaited<ReturnType<ReturnType<typeof freesoundClient>["search"]>> }>();

export async function searchFreesound(userId: string, q: string, page: number) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.start + 60_000 <= now) buckets.delete(key);
  let bucket = buckets.get(userId);
  if (!bucket) {
    if (buckets.size >= 2000) throw new CommandError(429, "FREESOUND_BUSY", "Search is busy; try again shortly");
    bucket = { start: now, used: 0 }; buckets.set(userId, bucket);
  }
  if (bucket.used >= 12) throw new CommandError(429, "FREESOUND_SEARCH_LIMIT", "Please wait before searching again");
  bucket.used++;
  const key = JSON.stringify([q.toLowerCase(), page]);
  const existing = cache.get(key);
  if (existing && existing.expires > now) return existing.data;
  // Transaction-scoped advisory lock prevents overlapping upstream calls by the same
  // author even on different server instances. The minute burst bucket is per instance.
  return prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`freesound-search:${userId}`}, 0)) AS acquired`;
    if (!lock.acquired) throw new CommandError(429, "FREESOUND_SEARCH_BUSY", "A search is already running");
    const data = await freesoundClient().search(q, page);
    for (const [k, entry] of cache) if (entry.expires <= now) cache.delete(k);
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, expires: Date.now() + 600_000 });
    return data;
  }, { maxWait: 10_000, timeout: 18_000 });
}

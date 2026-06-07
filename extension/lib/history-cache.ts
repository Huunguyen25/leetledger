import { browser } from "wxt/browser";
import constants from "@/constants";
import type { SolvedReview } from "@/lib/supabase/reviews";

/**
 * Solved-history cache for the popup.
 *
 * Persists up to 25 lightweight review rows in browser.storage.local so reopening
 * the popup can render tabs instantly. A single key keeps footprint tiny; the
 * payload is guarded by userId to prevent cross-account bleed.
 */

/** How long cached history is considered fresh before a background refresh. */
export const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;

const MAX_CACHED_REVIEWS = 25;

interface HistoryCache {
  userId: string;
  fetchedAt: number;
  reviews: SolvedReview[];
}

function isHistoryCache(value: unknown): value is HistoryCache {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "string" &&
    typeof v.fetchedAt === "number" &&
    Array.isArray(v.reviews)
  );
}

function isExpired(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > HISTORY_CACHE_TTL_MS;
}

/** Returns cached reviews for `userId`, or null if missing/stale/wrong user. */
export async function getHistoryCache(
  userId: string,
): Promise<{ reviews: SolvedReview[]; fresh: boolean } | null> {
  const result = await browser.storage.local.get(constants.HISTORY_CACHE_KEY);
  const cache = result[constants.HISTORY_CACHE_KEY];
  if (!isHistoryCache(cache)) return null;

  if (cache.userId !== userId) {
    await clearHistoryCache();
    return null;
  }

  if (isExpired(cache.fetchedAt)) {
    // Stale but still usable for stale-while-revalidate; caller may show then refresh.
    return { reviews: cache.reviews, fresh: false };
  }

  return { reviews: cache.reviews, fresh: true };
}

/** Writes review history for `userId` (capped at 25 rows). */
export async function setHistoryCache(
  userId: string,
  reviews: SolvedReview[],
): Promise<void> {
  const cache: HistoryCache = {
    userId,
    fetchedAt: Date.now(),
    reviews: reviews.slice(0, MAX_CACHED_REVIEWS),
  };
  await browser.storage.local.set({ [constants.HISTORY_CACHE_KEY]: cache });
}

/** Removes any persisted history cache. */
export async function clearHistoryCache(): Promise<void> {
  await browser.storage.local.remove(constants.HISTORY_CACHE_KEY);
}

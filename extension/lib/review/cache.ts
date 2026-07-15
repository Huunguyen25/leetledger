import { browser } from "wxt/browser";
import constants from "@/constants";
import type { SolvedReview } from "./types";

/** How long solved history is fresh before stale-while-revalidate refreshes it. */
export const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;

const MAX_CACHED_REVIEWS = 25;

interface HistoryCache {
  userId: string;
  fetchedAt: number;
  reviews: SolvedReview[];
}

function isHistoryCache(value: unknown): value is HistoryCache {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.fetchedAt === "number" &&
    Array.isArray(candidate.reviews)
  );
}

function isExpired(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > HISTORY_CACHE_TTL_MS;
}

/** Returns cached reviews for a user, including stale rows for revalidation. */
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

  return {
    reviews: cache.reviews,
    fresh: !isExpired(cache.fetchedAt),
  };
}

/** Writes the newest solved reviews for a user. */
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

export async function clearHistoryCache(): Promise<void> {
  await browser.storage.local.remove(constants.HISTORY_CACHE_KEY);
}

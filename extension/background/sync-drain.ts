import { retryPendingArchives } from "@/background/evolution-handler";
import constants from "@/constants";
import {
  listPendingReviews,
  removePendingReview,
} from "@/lib/review/pending";
import { upsertReview } from "@/lib/review/repository";

/**
 * Single drain for local → cloud sync: timeline archives and queued reviews.
 * Idempotent upserts keep retries safe. Called on SW start, browser online,
 * and explicit DRAIN_PENDING_SYNC messages.
 */

export interface DrainPendingSyncResult {
  archivesAttempted: boolean;
  reviewsFlushed: number;
  reviewsFailed: number;
}

let draining: Promise<DrainPendingSyncResult> | null = null;

async function flushPendingReviews(): Promise<{
  flushed: number;
  failed: number;
}> {
  const pending = await listPendingReviews();
  let flushed = 0;
  let failed = 0;

  for (const entry of pending) {
    const result = await upsertReview(entry.input);
    if (result.success) {
      await removePendingReview(entry.problemSlug);
      flushed += 1;
    } else {
      failed += 1;
    }
  }

  return { flushed, failed };
}

async function runDrain(): Promise<DrainPendingSyncResult> {
  await retryPendingArchives();
  const { flushed, failed } = await flushPendingReviews();
  return {
    archivesAttempted: true,
    reviewsFlushed: flushed,
    reviewsFailed: failed,
  };
}

/** Coalesces concurrent drains so online + startup do not double-fire. */
export function drainPendingSync(): Promise<DrainPendingSyncResult> {
  if (!draining) {
    draining = runDrain().finally(() => {
      draining = null;
    });
  }
  return draining;
}

export function registerSyncDrain(): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== constants.MESSAGE_TYPES.DRAIN_PENDING_SYNC) return;
    void drainPendingSync().then(sendResponse);
    return true;
  });

  const sw = globalThis as typeof globalThis & {
    addEventListener?: (type: string, listener: () => void) => void;
  };
  sw.addEventListener?.("online", () => {
    void drainPendingSync();
  });
}

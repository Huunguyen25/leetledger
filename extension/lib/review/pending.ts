import constants from "@/constants";
import type { ReviewInput } from "./types";

/**
 * Durable queue for review upserts that failed while offline / transiently.
 * Entries are keyed by problemSlug so retries stay idempotent with the cloud
 * `user_id,problem_slug` conflict target.
 */

export interface PendingReview {
  problemSlug: string;
  input: ReviewInput;
  queuedAt: number;
}

function isPendingReview(value: unknown): value is PendingReview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.problemSlug === "string" &&
    candidate.problemSlug.length > 0 &&
    typeof candidate.queuedAt === "number" &&
    candidate.input != null &&
    typeof candidate.input === "object"
  );
}

async function readQueue(): Promise<PendingReview[]> {
  const result = await browser.storage.local.get(constants.PENDING_REVIEWS_KEY);
  const raw = result[constants.PENDING_REVIEWS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPendingReview);
}

async function writeQueue(queue: PendingReview[]): Promise<void> {
  if (queue.length === 0) {
    await browser.storage.local.remove(constants.PENDING_REVIEWS_KEY);
    return;
  }
  await browser.storage.local.set({ [constants.PENDING_REVIEWS_KEY]: queue });
}

/** Enqueues (or replaces) a pending review for later flush. */
export async function enqueuePendingReview(
  input: ReviewInput,
): Promise<PendingReview> {
  const entry: PendingReview = {
    problemSlug: input.problemSlug,
    input,
    queuedAt: Date.now(),
  };
  const queue = await readQueue();
  const next = [
    ...queue.filter((item) => item.problemSlug !== entry.problemSlug),
    entry,
  ];
  await writeQueue(next);
  return entry;
}

export async function listPendingReviews(): Promise<PendingReview[]> {
  return readQueue();
}

export async function removePendingReview(problemSlug: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.problemSlug !== problemSlug));
}

export async function clearPendingReviews(): Promise<void> {
  await writeQueue([]);
}

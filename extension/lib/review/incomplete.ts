import constants from "@/constants";
import type { AssistanceLevel } from "@/lib/assistance/types";
import type { SubmissionPayload, TopicTag } from "@/types/submission";
import type { ReviewInput } from "./types";

/**
 * Local records for reviews the user dismissed or never finished. The popup
 * can reopen them; saving upserts to Supabase and clears the local entry.
 */

export interface IncompleteReview {
  problemSlug: string;
  submissionData: SubmissionPayload;
  draft?: Partial<
    Pick<
      ReviewInput,
      | "mastery"
      | "assistance"
      | "timeComplexity"
      | "spaceComplexity"
      | "notes"
      | "problemTitle"
    >
  > & {
    assistance?: AssistanceLevel;
    topicTags?: TopicTag[];
  };
  status: "skipped" | "incomplete";
  updatedAt: number;
}

function isIncompleteReview(value: unknown): value is IncompleteReview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.problemSlug === "string" &&
    candidate.submissionData != null &&
    typeof candidate.submissionData === "object" &&
    (candidate.status === "skipped" || candidate.status === "incomplete") &&
    typeof candidate.updatedAt === "number"
  );
}

async function readAll(): Promise<IncompleteReview[]> {
  const result = await browser.storage.local.get(
    constants.INCOMPLETE_REVIEWS_KEY,
  );
  const raw = result[constants.INCOMPLETE_REVIEWS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isIncompleteReview);
}

async function writeAll(reviews: IncompleteReview[]): Promise<void> {
  if (reviews.length === 0) {
    await browser.storage.local.remove(constants.INCOMPLETE_REVIEWS_KEY);
    return;
  }
  await browser.storage.local.set({
    [constants.INCOMPLETE_REVIEWS_KEY]: reviews,
  });
}

export async function upsertIncompleteReview(
  review: Omit<IncompleteReview, "updatedAt">,
): Promise<void> {
  const current = await readAll();
  const next: IncompleteReview = { ...review, updatedAt: Date.now() };
  await writeAll([
    ...current.filter((item) => item.problemSlug !== next.problemSlug),
    next,
  ]);
}

export async function listIncompleteReviews(): Promise<IncompleteReview[]> {
  const reviews = await readAll();
  return reviews.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getIncompleteReview(
  problemSlug: string,
): Promise<IncompleteReview | null> {
  const reviews = await readAll();
  return reviews.find((item) => item.problemSlug === problemSlug) ?? null;
}

export async function removeIncompleteReview(
  problemSlug: string,
): Promise<void> {
  const reviews = await readAll();
  await writeAll(reviews.filter((item) => item.problemSlug !== problemSlug));
}

export async function clearIncompleteReviews(): Promise<void> {
  await writeAll([]);
}

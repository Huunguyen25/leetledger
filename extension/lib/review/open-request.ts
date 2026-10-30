import constants from "@/constants";
import type { IncompleteReview } from "./incomplete";
import type { ReviewInput } from "./types";

/**
 * Popup → content-script handoff: open ReviewForm on a LeetCode problem page
 * prefilled from an incomplete or cloud review.
 */

export interface OpenReviewRequest {
  problemSlug: string;
  /** Prefill from incomplete draft or a fetched cloud review. */
  submissionData: IncompleteReview["submissionData"];
  draft?: IncompleteReview["draft"];
  /** When editing a completed cloud review, seed fields from this input. */
  existing?: Partial<ReviewInput>;
  requestedAt: number;
}

function isOpenReviewRequest(value: unknown): value is OpenReviewRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.problemSlug === "string" &&
    candidate.submissionData != null &&
    typeof candidate.submissionData === "object" &&
    typeof candidate.requestedAt === "number"
  );
}

export async function setOpenReviewRequest(
  request: Omit<OpenReviewRequest, "requestedAt">,
): Promise<void> {
  const value: OpenReviewRequest = {
    ...request,
    requestedAt: Date.now(),
  };
  await browser.storage.local.set({
    [constants.OPEN_REVIEW_REQUEST_KEY]: value,
  });
}

export async function peekOpenReviewRequest(
  problemSlug: string,
): Promise<OpenReviewRequest | null> {
  const result = await browser.storage.local.get(
    constants.OPEN_REVIEW_REQUEST_KEY,
  );
  const request = result[constants.OPEN_REVIEW_REQUEST_KEY];
  if (!isOpenReviewRequest(request)) return null;
  if (request.problemSlug !== problemSlug) return null;
  return request;
}

export async function consumeOpenReviewRequest(
  problemSlug: string,
): Promise<OpenReviewRequest | null> {
  const request = await peekOpenReviewRequest(problemSlug);
  if (!request) return null;
  await browser.storage.local.remove(constants.OPEN_REVIEW_REQUEST_KEY);
  return request;
}

export async function clearOpenReviewRequest(): Promise<void> {
  await browser.storage.local.remove(constants.OPEN_REVIEW_REQUEST_KEY);
}

/** Opens the LeetCode problem tab after queueing a form request (popup-safe). */
export async function requestReviewOnProblem(
  request: Omit<OpenReviewRequest, "requestedAt">,
): Promise<void> {
  await setOpenReviewRequest(request);
  const url = `https://leetcode.com/problems/${request.problemSlug}/`;
  window.open(url, "_blank", "noopener,noreferrer");
}

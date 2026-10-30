import { clearHistoryCache } from "@/lib/review/cache";
import { clearIncompleteReviews } from "@/lib/review/incomplete";
import { clearOpenReviewRequest } from "@/lib/review/open-request";
import { clearPendingReviews } from "@/lib/review/pending";
import { clearReviewPromptGate } from "@/lib/review/prompt-gate";
import {
  deleteTimelinesForIdentity,
  type TimelineIdentity,
} from "@/lib/evolution/storage";
import constants from "@/constants";

/**
 * Wipes local identity-scoped state when the signed-in pair changes or the
 * user signs out, so the next account cannot see prior timelines / drafts.
 */
export async function cleanupLocalIdentityData(
  identity: TimelineIdentity,
): Promise<void> {
  try {
    await deleteTimelinesForIdentity(identity);
  } catch (err) {
    console.error("Failed to delete timelines for identity:", err);
  }

  await Promise.all([
    clearHistoryCache(),
    clearPendingReviews(),
    clearIncompleteReviews(),
    clearReviewPromptGate(),
    clearOpenReviewRequest(),
    browser.storage.local.remove(constants.PROCESSED_ATTEMPTS_KEY),
  ]);
}

import constants from "@/constants";
import type { SubmissionStorageValue } from "@/types/submission";

/**
 * Helpers for reclaiming Accepted handoffs after a reload. The background
 * writes `ll_result:{clientId}:{attemptId}`; a new content-script boot mints a
 * fresh clientId, so keys from the previous boot must be scanned by problem.
 */

export interface PendingResultHandoff {
  key: string;
  attemptId: string;
  value: SubmissionStorageValue;
}

function isSubmissionStorageValue(
  value: unknown,
): value is SubmissionStorageValue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SubmissionStorageValue;
  return (
    candidate.data != null &&
    typeof candidate.data === "object" &&
    typeof candidate.data.problemSlug === "string" &&
    typeof candidate.data.status === "string"
  );
}

/** Lists unconsumed Accepted results for a problem, newest first. */
export async function listPendingResultsForProblem(
  problemSlug: string,
): Promise<PendingResultHandoff[]> {
  const all = await browser.storage.local.get();
  const matches: PendingResultHandoff[] = [];

  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(constants.STORAGE_PREFIX)) continue;
    if (!isSubmissionStorageValue(value)) continue;
    if (value.data.status !== "Accepted") continue;
    if (value.data.problemSlug !== problemSlug) continue;

    const attemptId = key.slice(constants.STORAGE_PREFIX.length).split(":")[1];
    if (!attemptId) continue;

    matches.push({ key, attemptId, value });
  }

  return matches.sort(
    (a, b) => (b.value.writtenAt ?? 0) - (a.value.writtenAt ?? 0),
  );
}

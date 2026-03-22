import {
  isValidSubmissionId,
  createSubmissionTracker,
} from "@/utils/background.logic";

import type {
  SubmissionPayload,
  SubmissionStorageValue,
} from "@/types/submission";

import constants from "@/constants";
function normalizeSubmissionData(
  raw: Record<string, unknown>,
  problemSlug: string,
  difficulty: string,
): SubmissionPayload {
  return {
    status: (raw.status_msg || raw.status) as string,
    runtime: (raw.status_runtime ?? "") as string,
    memory: (raw.status_memory ?? "") as string,
    runtimePercentile: (raw.runtime_percentile ?? 0) as number,
    memoryPercentile: (raw.memory_percentile ?? 0) as number,
    problemSlug,
    difficulty,
  };
}

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== constants.MESSAGE_TYPES.SUBMISSION_RESULT) return;

    const { submissionData, problemSlug, clientId, attemptId, difficulty } = message;

    if (!clientId || !attemptId) {
      console.warn("⚠️ Missing clientId or attemptId in SUBMISSION_RESULT");
      return;
    }

    if (!isValidSubmissionId(attemptId)) {
      console.log("🚫 Ignoring 'Run Code' or Test Case:", attemptId);
      return;
    }

    if (tracker.isDuplicate(attemptId)) {
      return;
    }
    tracker.startProcessing(attemptId);
    // Only save and notify if Accepted
    if (
      submissionData?.status_msg !== "Accepted" &&
      submissionData?.status !== "Accepted"
    ) {
      tracker.cancelProcessing(attemptId);
      return;
    }

    tracker.completeProcessing(attemptId);

    const storageKey = `${constants.STORAGE_PREFIX}${clientId}:${attemptId}`;
    const storageValue: SubmissionStorageValue = {
      data: normalizeSubmissionData(submissionData ?? {}, problemSlug ?? "", difficulty ?? ""),
      timestamp: Date.now(),
    };

    // 2. Write to local storage
    browser.storage.local
      .set({ [storageKey]: storageValue })
      .then(() => console.log(`💾 Saved result to storage [${storageKey}]`))
      .catch((err) => console.error("Storage write failed:", err));
  });
});

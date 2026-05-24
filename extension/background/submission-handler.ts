import {
  createSubmissionTracker,
  isValidSubmissionId,
} from "@/background/background.logic";
import type {
  SubmissionPayload,
  SubmissionStorageValue,
  TopicTag,
} from "@/types/submission";
import constants from "@/constants";

type SubmissionTracker = ReturnType<typeof createSubmissionTracker>;

function normalizeSubmissionData(
  raw: Record<string, unknown>,
  problemSlug: string,
  difficulty: string,
  code?: string | null,
  lang?: string | null,
  topicTags?: TopicTag[] | null,
): SubmissionPayload {
  return {
    status: (raw.status_msg || raw.status) as string,
    problemSlug,
    difficulty,
    ...(raw.question_id != null && { questionId: String(raw.question_id) }),
    ...(code != null && { code }),
    ...(lang != null && { lang }),
    ...(topicTags != null && topicTags.length > 0 && { topicTags }),
  };
}

/**
 * Registers the runtime.onMessage listener that handles SUBMISSION_RESULT
 * messages: validates them, de-duplicates via the tracker, and persists
 * accepted submissions to browser.storage.local.
 */
export function registerSubmissionHandler(tracker: SubmissionTracker) {
  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== constants.MESSAGE_TYPES.SUBMISSION_RESULT) return;
    const { submissionData, problemSlug, clientId, attemptId, difficulty, typedCode, lang, topicTags } = message;

    if (!clientId || !attemptId) {
      console.warn("⚠️ Missing clientId or attemptId in SUBMISSION_RESULT");
      return;
    }

    if (!isValidSubmissionId(attemptId)) {
      console.log("🚫 Ignoring 'Run Code' or Test Case:", attemptId);
      return;
    }

    if (tracker.isDuplicate(attemptId)) return;
    
    tracker.startProcessing(attemptId);

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
      data: normalizeSubmissionData(
        submissionData ?? {},
        problemSlug ?? "",
        difficulty ?? "",
        typedCode,
        lang,
        topicTags,
      ),
      timestamp: Date.now(),
    };

    browser.storage.local
      .set({ [storageKey]: storageValue })
      .then(() => console.log(`💾 Saved result to storage [${storageKey}]`))
      .catch((err) => console.error("Storage write failed:", err));
  });
}

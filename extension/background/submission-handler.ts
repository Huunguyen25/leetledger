import { createSubmissionTracker } from "@/background/submission-tracker";
import { getActiveIdentity } from "@/background/identity-store";
import { isValidSubmissionId } from "@/lib/leetcode/routes";
import type {
  SubmissionPayload,
  SubmissionStorageValue,
  TopicTag,
} from "@/types/submission";
import constants from "@/constants";

type SubmissionTracker = ReturnType<typeof createSubmissionTracker>;

/**
 * Result keys are namespaced by a per-page-session clientId and are normally
 * removed the moment the live content script consumes the storage.onChanged
 * event. If a tab is closed/reloaded before consuming one, its key is orphaned
 * (no future client shares that clientId). Sweep only TTL-expired keys on
 * service-worker startup so a recent Accepted handoff survives SW restarts.
 */
export async function clearStaleResults(
  now = Date.now(),
  ttlMs = constants.RESULT_TTL_MS,
): Promise<string[]> {
  try {
    const all = await browser.storage.local.get();
    const staleKeys: string[] = [];

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith(constants.STORAGE_PREFIX)) continue;
      const writtenAt =
        value &&
        typeof value === "object" &&
        typeof (value as SubmissionStorageValue).writtenAt === "number"
          ? (value as SubmissionStorageValue).writtenAt
          : 0;
      // Legacy keys without writtenAt are treated as already stale.
      if (!writtenAt || now - writtenAt > ttlMs) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length > 0) {
      await browser.storage.local.remove(staleKeys);
    }
    return staleKeys;
  } catch (err) {
    console.error("Failed to clear stale results:", err);
    return [];
  }
}

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
    ...(typeof lang === "string" && lang.trim() && { lang: lang.trim() }),
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

    if (!getActiveIdentity()) {
      console.warn("⚠️ Ignoring SUBMISSION_RESULT: identity not active");
      return;
    }

    const {
      submissionData,
      problemSlug,
      clientId,
      attemptId,
      difficulty,
      typedCode,
      lang,
      topicTags,
    } = message;

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
      writtenAt: Date.now(),
    };

    browser.storage.local
      .set({ [storageKey]: storageValue })
      .then(() => console.log(`💾 Saved result to storage [${storageKey}]`))
      .catch((err) => console.error("Storage write failed:", err));
  });
}

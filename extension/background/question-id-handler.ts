import constants from "@/constants";
import { mergeQuestionId } from "@/lib/leetcode/question-id-map";

/**
 * Single writer for the persisted slug → questionId map. Content scripts may
 * fetch ids concurrently; only these storage updates are serialized.
 */

let persistQueue: Promise<void> = Promise.resolve();

function enqueuePersist(
  problemSlug: string,
  questionId: string,
): Promise<void> {
  const run = () => mergeQuestionId(problemSlug, questionId);
  const next = persistQueue.then(run, run);
  persistQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function isPersistMessage(
  message: unknown,
): message is { problemSlug: string; questionId: string } {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  return (
    candidate.type === constants.MESSAGE_TYPES.PERSIST_QUESTION_ID &&
    typeof candidate.problemSlug === "string" &&
    candidate.problemSlug.length > 0 &&
    typeof candidate.questionId === "string" &&
    candidate.questionId.length > 0
  );
}

export function registerQuestionIdHandler(): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isPersistMessage(message)) return;

    void enqueuePersist(message.problemSlug, message.questionId)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  });
}

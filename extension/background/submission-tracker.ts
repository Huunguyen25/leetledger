import constants from "@/constants";

/**
 * Dedupes Accepted submissions across SW restarts and tabs by persisting
 * processed attemptIds in browser.storage.local (LRU-capped).
 */

interface ProcessedAttemptsState {
  attemptIds: string[];
}

function isProcessedState(value: unknown): value is ProcessedAttemptsState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.attemptIds);
}

/** Creates a tracker that prevents duplicate submission processing. */
export function createSubmissionTracker(maxStored = 100) {
  const processedSubmissions = new Set<string>();
  const processing = new Set<string>();
  let hydrated = false;
  let persistChain: Promise<void> = Promise.resolve();

  async function persist(): Promise<void> {
    const state: ProcessedAttemptsState = {
      attemptIds: [...processedSubmissions],
    };
    await browser.storage.local.set({
      [constants.PROCESSED_ATTEMPTS_KEY]: state,
    });
  }

  function queuePersist(): void {
    persistChain = persistChain.then(persist).catch((err) => {
      console.error("Failed to persist processed attempts:", err);
    });
  }

  return {
    /** Loads durable attemptIds written by prior SW generations. */
    async hydrate(): Promise<void> {
      if (hydrated) return;
      try {
        const result = await browser.storage.local.get(
          constants.PROCESSED_ATTEMPTS_KEY,
        );
        const stored = result[constants.PROCESSED_ATTEMPTS_KEY];
        if (isProcessedState(stored)) {
          for (const id of stored.attemptIds.slice(-maxStored)) {
            processedSubmissions.add(id);
          }
        }
      } catch (err) {
        console.error("Failed to hydrate processed attempts:", err);
      } finally {
        hydrated = true;
      }
    },

    isDuplicate(submissionId: string): boolean {
      return (
        processedSubmissions.has(submissionId) || processing.has(submissionId)
      );
    },

    startProcessing(submissionId: string): void {
      processing.add(submissionId);
    },

    cancelProcessing(submissionId: string): void {
      processing.delete(submissionId);
    },

    completeProcessing(submissionId: string): void {
      processing.delete(submissionId);
      processedSubmissions.add(submissionId);

      while (processedSubmissions.size > maxStored) {
        const oldestSubmission = processedSubmissions.values().next().value;
        if (oldestSubmission === undefined) break;
        processedSubmissions.delete(oldestSubmission);
      }

      queuePersist();
    },

    /** Clears in-flight processing flags after an account change. */
    clearProcessing(): void {
      processing.clear();
    },

    /** Drops durable + in-memory dedupe (account change / sign-out). */
    async clearAll(): Promise<void> {
      processing.clear();
      processedSubmissions.clear();
      await browser.storage.local.remove(constants.PROCESSED_ATTEMPTS_KEY);
    },
  };
}

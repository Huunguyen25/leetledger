/** Creates an in-memory tracker that prevents duplicate submission processing. */
export function createSubmissionTracker(maxStored = 100) {
  const processedSubmissions = new Set<string>();
  const processing = new Set<string>();

  return {
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

      if (processedSubmissions.size > maxStored) {
        const oldestSubmission = processedSubmissions.values().next().value;
        if (oldestSubmission !== undefined) {
          processedSubmissions.delete(oldestSubmission);
        }
      }
    },

    /** Clears in-flight processing flags after an account change. */
    clearProcessing(): void {
      processing.clear();
    },
  };
}

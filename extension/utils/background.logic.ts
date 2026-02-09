/**
 * Checks if a URL is a submission check URL.
 */
export function isSubmissionUrl(url: string): boolean {
  return url.includes("/check/");
}

/**
 * Extracts the submission ID from a LeetCode submission check URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
export function extractSubmissionId(url: string): string | null {
  const match = url.match(/\/submissions\/detail\/([^/]+)\/check\//);
  return match ? match[1] : null;
}

/**
 * Checks if a submission ID is a valid numeric submission (not a test run).
 */
export function isValidSubmissionId(submissionId: string): boolean {
  return /^\d+$/.test(submissionId);
}

/**
 * Creates a submission tracker that prevents duplicate processing.
 */
export function createSubmissionTracker(maxStored: number = 100) {
  const processedSubmissions = new Set<string>();
  const processing = new Set<string>();

  return {
    /**
     * Checks if a submission ID has already been processed or is being processed.
     */
    isDuplicate(submissionId: string): boolean {
      return processedSubmissions.has(submissionId) || processing.has(submissionId);
    },

    /**
     * Marks a submission as currently being processed.
     */
    startProcessing(submissionId: string): void {
      processing.add(submissionId);
    },

    /**
     * Marks a submission as no longer being processed (without adding to completed).
     */
    cancelProcessing(submissionId: string): void {
      processing.delete(submissionId);
    },

    /**
     * Marks a submission as completed (moves from processing to processed).
     */
    completeProcessing(submissionId: string): void {
      processing.delete(submissionId);
      processedSubmissions.add(submissionId);

      // Evict oldest if over limit
      if (processedSubmissions.size > maxStored) {
        const firstItem = processedSubmissions.values().next().value;
        if (firstItem !== undefined) {
          processedSubmissions.delete(firstItem);
        }
      }
    },

    /**
     * Returns the current count of processed submissions.
     */
    getProcessedCount(): number {
      return processedSubmissions.size;
    },

    /**
     * Returns the current count of submissions being processed.
     */
    getProcessingCount(): number {
      return processing.size;
    },
  };
}
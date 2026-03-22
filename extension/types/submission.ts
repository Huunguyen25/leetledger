/** Normalized submission data shown in UI */
export interface SubmissionPayload {
  status: string;
  runtime: string;
  memory: string;
  runtimePercentile: number;
  memoryPercentile: number;
  problemSlug: string;
  difficulty: string;
}

/** Shape stored in browser.storage.local */
export interface SubmissionStorageValue {
  data: SubmissionPayload;
  timestamp: number;
}

export interface SubmissionInterceptedMessage {
  type: string; // narrowed by constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED
  token: string;
  clientId: string;
  problemSlug: string;
  attemptId: string;
  submissionData: Record<string, unknown>;
}

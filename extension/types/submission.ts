/** Normalized submission data shown in UI */
export interface SubmissionPayload {
  status: string;
  problemSlug: string;
  difficulty: string;
  code?: string;
  lang?: string;
  questionId?: string;
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
  attemptId: string;
  submissionData: Record<string, unknown>;
  typedCode?: string | null;
  lang?: string | null;
}

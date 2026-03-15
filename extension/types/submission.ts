/** Normalized submission data shown in UI */
export interface SubmissionPayload {
    status: string;
    runtime: string;
    memory: string;
    runtimePercentile: number;
    memoryPercentile: number;
    problemSlug: string;
  }
  
  /** Shape stored in browser.storage.local */
  export interface SubmissionStorageValue {
    data: SubmissionPayload;
    timestamp: number;
  }
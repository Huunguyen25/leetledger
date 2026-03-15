/** Extension-wide constants for cross-script communication and parsing */
const constants = {
  MESSAGE_TYPES: {
    SUBMISSION_INTERCEPTED: "LEETCODE_SUBMISSION_INTERCEPTED",
    SUBMISSION_RESULT: "SUBMISSION_RESULT",
  } as const,
  STORAGE_PREFIX: "ll_result:",
  /** Regex: submission ID must be numeric (excludes "Run Code" / test runs) */
  VALID_SUBMISSION_ID_REGEX: /^\d+$/,
  /** Regex: extract ID from /submissions/detail/{id}/check/ */
  SUBMISSION_ID_EXTRACT_REGEX: /\/submissions\/detail\/([^/]+)\/check\//,
};

export default constants;
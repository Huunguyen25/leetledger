/** Extension-wide constants for cross-script communication and parsing */
const constants = {
  MESSAGE_TYPES: {
    SUBMISSION_INTERCEPTED: "LEETCODE_SUBMISSION_INTERCEPTED",
    SUBMISSION_RESULT: "SUBMISSION_RESULT",
    IDENTITY_REPORT: "IDENTITY_REPORT",
    /** Page-world -> content-script: an assistance signal was detected. */
    ASSISTANCE_SIGNAL: "LEETCODE_ASSISTANCE_SIGNAL",
  } as const,
  STORAGE_PREFIX: "ll_result:",
  /**
   * Storage key holding the epoch-ms timestamp until which the on-page review
   * drawer is suppressed. Shared so the popup can write it and the content
   * script can read it. See `lib/review/mute.ts`.
   */
  MUTE_KEY: "ll_mute_until",
  /**
   * Storage key holding the email awaiting OTP verification (with an expiry).
   * Lets the popup restore the 6-digit verify form after it is closed and
   * reopened, instead of forcing a fresh email entry / wasted resend.
   * See `entrypoints/popup/auth/pending-otp.ts`.
   */
  PENDING_OTP_KEY: "ll_pending_otp",
  /**
   * Storage key for the solved-history cache (user-scoped payload inside).
   * See `lib/review/cache.ts`.
   */
  HISTORY_CACHE_KEY: "ll_history_cache",
  /**
   * Canonical identity snapshot (state, usernames, timestamps). Written by the
   * background identity store; read by content scripts and future sync features.
   */
  IDENTITY_KEY: "ll_active_identity",
  /**
   * Web dashboard URL opened from the popup. Override per environment with the
   * WXT_DASHBOARD_URL env var; falls back to the local Next.js dev server.
   */
  DASHBOARD_URL:
    (import.meta.env.WXT_DASHBOARD_URL as string | undefined) ??
    "http://localhost:3000",
};

export default constants;
/** Extension-wide constants for cross-script communication and parsing */
const constants = {
  MESSAGE_TYPES: {
    SUBMISSION_INTERCEPTED: "LEETCODE_SUBMISSION_INTERCEPTED",
    SUBMISSION_RESULT: "SUBMISSION_RESULT",
    IDENTITY_REPORT: "IDENTITY_REPORT",
    /** Page-world -> content-script: an assistance signal was detected. */
    ASSISTANCE_SIGNAL: "LEETCODE_ASSISTANCE_SIGNAL",
    /** Page-world -> content-script: exact code from a Run or Submit request. */
    CODE_MILESTONE: "LEETCODE_CODE_MILESTONE",
    /** Content-script -> background: an observed editor code version. */
    CODE_OBSERVED: "CODE_OBSERVED",
    /** Content-script -> background: close and archive the accepted session. */
    SESSION_ACCEPTED: "SESSION_ACCEPTED",
    /** Content-script -> background: merge one slug→questionId into storage. */
    PERSIST_QUESTION_ID: "PERSIST_QUESTION_ID",
    /** Any runtime -> background: flush pending archives and reviews. */
    DRAIN_PENDING_SYNC: "DRAIN_PENDING_SYNC",
  } as const,
  STORAGE_PREFIX: "ll_result:",
  /**
   * Unconsumed Accepted handoffs older than this are swept on SW wake.
   * Fresh keys survive restarts so the content script can still open the form.
   */
  RESULT_TTL_MS: 60 * 60 * 1000,
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
   * See `lib/supabase/pending-otp.ts`.
   */
  PENDING_OTP_KEY: "ll_pending_otp",
  /**
   * Storage key for the solved-history cache (user-scoped payload inside).
   * See `lib/review/cache.ts`.
   */
  HISTORY_CACHE_KEY: "ll_history_cache",
  /**
   * Reviews queued after offline / transient upsert failures. Flushed by the
   * shared pending-sync drain. See `lib/review/pending.ts`.
   */
  PENDING_REVIEWS_KEY: "ll_pending_reviews",
  /**
   * Persisted Accepted attemptIds so SW restarts and multi-tab races do not
   * reprocess the same submission. See `background/submission-tracker.ts`.
   */
  PROCESSED_ATTEMPTS_KEY: "ll_processed_attempts",
  /**
   * Per-problem prompt gate: recent completes, skips, and open claims used to
   * keep Accepted → at most one review drawer (including across tabs).
   * See `lib/review/prompt-gate.ts`.
   */
  REVIEW_PROMPT_GATE_KEY: "ll_review_prompt_gate",
  /**
   * Incomplete / skipped reviews that can be reopened from the popup.
   * See `lib/review/incomplete.ts`.
   */
  INCOMPLETE_REVIEWS_KEY: "ll_incomplete_reviews",
  /**
   * One-shot request from the popup to open ReviewForm on a problem page.
   * See `lib/review/open-request.ts`.
   */
  OPEN_REVIEW_REQUEST_KEY: "ll_open_review",
  /**
   * Canonical identity snapshot (state, usernames, timestamps). Written by the
   * background identity store; read by content scripts and future sync features.
   */
  IDENTITY_KEY: "ll_active_identity",
  /**
   * Cached problem-slug -> LeetCode question ID map. The question ID is part of
   * LeetCode's editor record key and never changes for a problem. Written only
   * by the background queue; see `background/question-id-handler.ts`.
   */
  PROBLEM_ID_MAP_KEY: "ll_problem_id_map",
  /**
   * Private Supabase Storage bucket holding gzipped code-evolution timelines.
   * See `lib/evolution/archive.ts`.
   */
  TIMELINE_BUCKET: "code-timelines",
  /**
   * Web dashboard URL opened from the popup. Override per environment with the
   * WXT_DASHBOARD_URL env var; falls back to the local Next.js dev server.
   */
  DASHBOARD_URL:
    (import.meta.env.WXT_DASHBOARD_URL as string | undefined) ??
    "http://localhost:3000",
};

export default constants;
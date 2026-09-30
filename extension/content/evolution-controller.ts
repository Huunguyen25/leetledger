import { browser } from "wxt/browser";
import constants from "@/constants";
import {
  readCurrentEditorCode,
  closeLeetCodeDb,
  resolveLanguage,
} from "@/lib/leetcode/editor-code";
import { getLeetCodeRouteContext } from "@/lib/leetcode/routes";
import type {
  CodeMilestoneMessage,
  CodeObservedMessage,
  EvolutionSource,
  SessionAcceptedMessage,
} from "@/types/evolution";

/**
 * Schedules code-evolution observations while the user is on a problem page.
 *
 * This is a poller, not an IndexedDB change listener: IndexedDB offers no
 * cross-application change subscription, so each tick reads LeetCode's latest
 * autosaved code. Every durable decision (normalization, thresholds, patches)
 * belongs to the background worker; the last-sent comparison here only avoids
 * messaging the same text repeatedly.
 */

const POLL_INTERVAL_MS = 1000;

export interface EvolutionControls {
  teardown: () => void;
  onNavigate: () => void;
  /** Forwards exact Run/Submit code captured by the page bridge. */
  recordMilestone: (milestone: CodeMilestoneMessage) => void;
  /** Closes and archives the session behind an accepted submission. */
  recordAcceptedSubmission: (input: {
    problemSlug: string;
    submissionId: string;
    code: string | null;
    language: string | null;
  }) => void;
}

export interface EvolutionControllerOptions {
  intervalMs?: number;
  readCode?: typeof readCurrentEditorCode;
  getPathname?: () => string;
}

function sendObservation(message: Omit<CodeObservedMessage, "type">) {
  void browser.runtime
    .sendMessage({
      type: constants.MESSAGE_TYPES.CODE_OBSERVED,
      ...message,
    })
    .catch(() => {
      // The background may be restarting; the next tick retries.
    });
}

export function startEvolutionTracking(
  options: EvolutionControllerOptions = {},
): EvolutionControls {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const readCode = options.readCode ?? readCurrentEditorCode;
  const getPathname = options.getPathname ?? (() => window.location.pathname);

  let lastSentCode: string | null = null;
  let boundSlug: string | null = null;
  let reading = false;
  let stopped = false;

  function activeProblemSlug(): string | null {
    const route = getLeetCodeRouteContext(getPathname());
    return route.kind === "problem" ? route.slug : null;
  }

  /** Local dedupe is per problem; reset whenever the active problem changes. */
  function bindSlug(slug: string | null) {
    if (slug === boundSlug) return;
    boundSlug = slug;
    lastSentCode = null;
  }

  function forwardCode(
    code: string,
    language: string,
    problemSlug: string,
    source: EvolutionSource,
    timestamp: number,
    submissionId?: string,
  ) {
    lastSentCode = code;
    sendObservation({
      source,
      code,
      language,
      problemSlug,
      timestamp,
      ...(submissionId && { submissionId }),
    });
  }

  async function poll() {
    if (stopped || reading) return;

    const slug = activeProblemSlug();
    bindSlug(slug);
    if (!slug) return;

    reading = true;
    try {
      const result = await readCode(slug);
      if (stopped || !result.ok || result.code.length === 0) return;
      if (activeProblemSlug() !== slug) return;
      if (result.code === lastSentCode) return;

      forwardCode(result.code, result.language, slug, "autosave", Date.now());
    } finally {
      reading = false;
    }
  }

  // Capture must never surface an unhandled rejection into LeetCode's page.
  const tick = () => void poll().catch(() => undefined);
  const timer = setInterval(tick, intervalMs);
  tick();

  return {
    onNavigate() {
      bindSlug(activeProblemSlug());
    },

    recordMilestone(milestone) {
      const slug = milestone.problemSlug ?? activeProblemSlug();
      if (stopped || !slug || !milestone.code) return;

      forwardCode(
        milestone.code,
        resolveLanguage(milestone.language) ?? "unknown",
        slug,
        milestone.source,
        milestone.timestamp,
        milestone.submissionId,
      );
    },

    recordAcceptedSubmission({ problemSlug, submissionId, code, language }) {
      if (stopped) return;

      const message: Omit<SessionAcceptedMessage, "type"> = {
        problemSlug,
        submissionId,
        code,
        language: resolveLanguage(language),
        timestamp: Date.now(),
      };
      // Keep lastSentCode so the next autosave poll of unchanged editor code
      // does not reopen a ghost session after Accept closes the active one.
      if (code) lastSentCode = code;
      void browser.runtime
        .sendMessage({
          type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
          ...message,
        })
        .catch(() => undefined);
    },

    teardown() {
      stopped = true;
      clearInterval(timer);
      lastSentCode = null;
      boundSlug = null;
      closeLeetCodeDb();
    },
  };
}

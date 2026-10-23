import { getActiveIdentity } from "@/background/identity-store";
import constants from "@/constants";
import { archiveTimeline } from "@/lib/evolution/archive";
import {
  buildScopeKey,
  getActiveTimeline,
  getActiveTimelinesForProblem,
  getLatestClosedTimeline,
  listTimelinesByStatus,
  markTimelineAccepted,
  updateActiveTimeline,
  type TimelineScope,
} from "@/lib/evolution/storage";
import {
  appendObservation,
  checksumCode,
  normalizeCode,
  type AppendResult,
} from "@/lib/evolution/timeline";
import type {
  CodeObservationResult,
  CodeObservedMessage,
  EvolutionSource,
  SessionAcceptedMessage,
  TimelineRecord,
} from "@/types/evolution";

/**
 * Background owner of code-evolution writes. Identity always comes from the
 * canonical store here, never from the reporting page or content script, and
 * writes for one editor scope are serialized so two tabs cannot interleave a
 * read-modify-write cycle.
 */

const EVOLUTION_SOURCES: readonly EvolutionSource[] = [
  "autosave",
  "run",
  "submit",
];

interface AppendOutcome {
  appended: AppendResult;
  timelineId: string;
}

const scopeQueues = new Map<string, Promise<unknown>>();

/** Runs `task` after any pending work for the same editor scope. */
function enqueue<T>(scopeKey: string, task: () => Promise<T>): Promise<T> {
  const pending = scopeQueues.get(scopeKey) ?? Promise.resolve();
  const next = pending.then(task, task);

  scopeQueues.set(
    scopeKey,
    next.catch(() => undefined),
  );
  void next.finally(() => {
    if (scopeQueues.get(scopeKey) === next) scopeQueues.delete(scopeKey);
  });

  return next;
}

function isCodeObservedMessage(
  message: unknown,
): message is CodeObservedMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;

  return (
    candidate.type === constants.MESSAGE_TYPES.CODE_OBSERVED &&
    typeof candidate.code === "string" &&
    typeof candidate.problemSlug === "string" &&
    candidate.problemSlug.length > 0 &&
    typeof candidate.language === "string" &&
    candidate.language.length > 0 &&
    typeof candidate.timestamp === "number" &&
    EVOLUTION_SOURCES.includes(candidate.source as EvolutionSource)
  );
}

function isSessionAcceptedMessage(
  message: unknown,
): message is SessionAcceptedMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;

  return (
    candidate.type === constants.MESSAGE_TYPES.SESSION_ACCEPTED &&
    typeof candidate.problemSlug === "string" &&
    candidate.problemSlug.length > 0 &&
    typeof candidate.submissionId === "string" &&
    candidate.submissionId.length > 0
  );
}

/** Blank strings are missing — never coerce null into "". */
function usableLanguage(lang: string | null | undefined): string | null {
  const trimmed = lang?.trim();
  return trimmed ? trimmed : null;
}

function resolveScope(
  problemSlug: string,
  language: string,
): TimelineScope | null {
  const identity = getActiveIdentity();
  if (!identity?.supabaseUid || !identity.leetcodeUsername) return null;

  return {
    supabaseUid: identity.supabaseUid,
    leetcodeUsername: identity.leetcodeUsername,
    problemSlug,
    language,
  };
}

/**
 * When Accept arrives without a language, recover it from the open session(s)
 * for this problem so we do not leave an active timeline unarchived.
 */
async function inferLanguageFromActiveTimelines(
  problemSlug: string,
  code: string | null,
): Promise<string | null> {
  const identity = getActiveIdentity();
  if (!identity?.supabaseUid || !identity.leetcodeUsername) return null;

  const active = await getActiveTimelinesForProblem(
    {
      supabaseUid: identity.supabaseUid,
      leetcodeUsername: identity.leetcodeUsername,
    },
    problemSlug,
  );
  if (active.length === 0) return null;
  if (active.length === 1) return active[0].language;

  if (code) {
    const checksum = checksumCode(normalizeCode(code));
    const match = active.find(
      (timeline: TimelineRecord) => timeline.headChecksum === checksum,
    );
    if (match) return match.language;
  }

  // Most recently updated active session for this problem.
  return active[0].language;
}

async function resolveAcceptLanguage(
  problemSlug: string,
  language: string | null | undefined,
  code: string | null,
): Promise<string | null> {
  return (
    usableLanguage(language) ??
    (await inferLanguageFromActiveTimelines(problemSlug, code))
  );
}

/**
 * True when there is no active session and `code` is identical to the latest
 * closed head for this scope. Used to refuse ghost re-opens after Accept.
 */
async function matchesLatestClosedHead(
  scope: TimelineScope,
  code: string,
): Promise<boolean> {
  if (await getActiveTimeline(scope)) return false;

  const closed = await getLatestClosedTimeline(scope);
  if (!closed) return false;

  return checksumCode(normalizeCode(code)) === closed.headChecksum;
}

/**
 * After Accept closes the active session, unchanged editor code may arrive via
 * autosave, Run, or Submit. Refuse to open a new session that merely repeats
 * the last closed head; a real edit (different checksum) starts a new attempt.
 */
async function isPostAcceptSameHeadGhost(
  scope: TimelineScope,
  message: CodeObservedMessage,
): Promise<boolean> {
  return matchesLatestClosedHead(scope, message.code);
}

/** Appends one observed code version to the active session for its scope. */
export async function handleCodeObserved(
  message: CodeObservedMessage,
): Promise<CodeObservationResult> {
  const scope = resolveScope(message.problemSlug, message.language);
  if (!scope) return { status: "rejected", reason: "identity_inactive" };

  return enqueue(buildScopeKey(scope), async () => {
    try {
      if (await isPostAcceptSameHeadGhost(scope, message)) {
        return { status: "ignored", reason: "duplicate" };
      }

      const outcome = await updateActiveTimeline<AppendOutcome>(scope, (timeline) => {
        const appended = appendObservation(timeline, {
          code: message.code,
          source: message.source,
          timestamp: message.timestamp,
          ...(message.submissionId && { submissionId: message.submissionId }),
        });
        if (appended.kind === "ignored") {
          return { result: { appended, timelineId: timeline.id } };
        }

        return {
          record: {
            ...timeline,
            headCode: appended.headCode,
            headChecksum: appended.headChecksum,
            snapshots: [...timeline.snapshots, appended.snapshot],
          },
          result: { appended, timelineId: timeline.id },
        };
      });

      if (!outcome) return { status: "failed", reason: "storage_error" };
      if (outcome.appended.kind === "ignored") {
        return { status: "ignored", reason: outcome.appended.reason };
      }

      return {
        status: "stored",
        timelineId: outcome.timelineId,
        sequence: outcome.appended.snapshot.sequence,
      };
    } catch {
      return { status: "failed", reason: "storage_error" };
    }
  });
}

/**
 * Closes the session behind an accepted submission and backs it up. The local
 * timeline is preserved regardless of upload outcome.
 */
export async function handleSessionAccepted(
  message: SessionAcceptedMessage,
): Promise<void> {
  const language = await resolveAcceptLanguage(
    message.problemSlug,
    message.language,
    message.code,
  );
  const scope = language
    ? resolveScope(message.problemSlug, language)
    : null;
  if (!scope || !language) return;

  await enqueue(buildScopeKey(scope), async () => {
    // Re-Accept of the exact closed solution must not open or archive a thin
    // new session (common when retesting the review form with no edits).
    if (message.code && (await matchesLatestClosedHead(scope, message.code))) {
      return;
    }

    // The bridge already recorded a submit milestone on click. Only append
    // again when Accept carries different code; identical code would only
    // produce a duplicate submit marker.
    if (message.code) {
      await updateActiveTimeline(scope, (timeline) => {
        const code = normalizeCode(message.code as string);
        if (checksumCode(code) === timeline.headChecksum) {
          return null;
        }

        const appended = appendObservation(timeline, {
          code,
          source: "submit",
          timestamp: message.timestamp,
          submissionId: message.submissionId,
        });
        if (appended.kind === "ignored") return null;

        return {
          record: {
            ...timeline,
            headCode: appended.headCode,
            headChecksum: appended.headChecksum,
            snapshots: [...timeline.snapshots, appended.snapshot],
          },
          result: appended,
        };
      });
    }

    const accepted = await markTimelineAccepted(scope, message.submissionId);
    if (accepted) await archiveTimeline(accepted);
  });
}

/** Retries backups that were accepted locally but never reached Supabase. */
export async function retryPendingArchives(): Promise<void> {
  try {
    const pending = [
      ...(await listTimelinesByStatus("accepted")),
      ...(await listTimelinesByStatus("archive_failed")),
    ];
    for (const timeline of pending) {
      await archiveTimeline(timeline);
    }
  } catch {
    // Retrying is opportunistic; the next startup will try again.
  }
}

export function registerEvolutionHandler(): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isCodeObservedMessage(message)) {
      void handleCodeObserved(message).then(sendResponse);
      return true;
    }

    if (isSessionAcceptedMessage(message)) {
      void handleSessionAccepted(message).then(() => sendResponse({ ok: true }));
      return true;
    }
  });
}

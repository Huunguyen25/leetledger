import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import ReviewForm, {
  type ReviewFormPrefill,
} from "@/components/page/ReviewDrawer/ReviewForm";
import constants from "@/constants";
import { setupAssistanceDetectors } from "@/lib/assistance/detectors";
import { createAssistanceSession } from "@/lib/assistance/session";
import { isAssistanceLevel } from "@/lib/assistance/types";
import { checksumCode, normalizeCode } from "@/lib/evolution/timeline";
import {
  getLeetCodeRouteContext,
  parseProblemSlugFromPathname,
} from "@/lib/leetcode/routes";
import { upsertIncompleteReview } from "@/lib/review/incomplete";
import { isMuted } from "@/lib/review/mute";
import {
  consumeOpenReviewRequest,
  type OpenReviewRequest,
} from "@/lib/review/open-request";
import {
  claimReviewPrompt,
  markReviewCompleted,
  markReviewSkipped,
  releaseReviewClaim,
} from "@/lib/review/prompt-gate";
import { listPendingResultsForProblem } from "@/lib/review/result-handoff";
import type { AssistanceSignalMessage } from "@/types/assistance";
import type { CodeMilestoneMessage } from "@/types/evolution";
import type {
  SubmissionInterceptedMessage,
  SubmissionPayload,
  SubmissionStorageValue,
} from "@/types/submission";
import { startEvolutionTracking } from "./evolution-controller";

export interface TrackingControls {
  teardown: () => void;
  onNavigate: () => void;
}

function getProblemDifficulty(): string {
  const difficultyElement = document.querySelector(
    '[class*="text-difficulty-easy"], [class*="text-difficulty-medium"], [class*="text-difficulty-hard"]',
  );
  return difficultyElement?.textContent?.trim() ?? "Unknown";
}

function createBridgeScript(token: string, clientId: string) {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("/fetch-bridge.js");
  script.dataset.token = token;
  script.dataset.clientId = clientId;
  return script;
}

function isSubmissionInterceptedMessage(
  data: unknown,
  expectedToken: string,
): data is SubmissionInterceptedMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED &&
    message.token === expectedToken &&
    typeof message.clientId === "string" &&
    typeof message.attemptId === "string"
  );
}

function isCodeMilestoneMessage(
  data: unknown,
  expectedToken: string,
): data is CodeMilestoneMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === constants.MESSAGE_TYPES.CODE_MILESTONE &&
    message.token === expectedToken &&
    typeof message.code === "string" &&
    (message.source === "run" || message.source === "submit")
  );
}

function isAssistanceSignalMessage(
  data: unknown,
  expectedToken: string,
): data is AssistanceSignalMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === constants.MESSAGE_TYPES.ASSISTANCE_SIGNAL &&
    message.token === expectedToken &&
    isAssistanceLevel(message.level)
  );
}

function shouldTeardownReviewForm(
  pathname: string,
  boundSlug: string,
): boolean {
  const route = getLeetCodeRouteContext(pathname);
  if (route.kind === "submission_detail") return false;
  return route.kind !== "problem" || route.slug !== boundSlug;
}

function codeChecksumOf(payload: SubmissionPayload): string | null {
  if (!payload.code) return null;
  return checksumCode(normalizeCode(payload.code));
}

function prefillFromOpenRequest(
  request: OpenReviewRequest,
): ReviewFormPrefill | undefined {
  const draft = request.draft ?? {};
  const existing = request.existing ?? {};
  return {
    mastery: draft.mastery ?? existing.mastery,
    assistance: draft.assistance ?? existing.assistance,
    timeComplexity: draft.timeComplexity ?? existing.timeComplexity,
    spaceComplexity: draft.spaceComplexity ?? existing.spaceComplexity,
    notes: draft.notes ?? existing.notes,
    problemTitle: draft.problemTitle ?? existing.problemTitle,
  };
}

/** Starts submission capture, assistance tracking, and review-drawer UI. */
export function startContentTracking(
  ctx: ContentScriptContext,
): TrackingControls {
  const token = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  let reactRoot: ReactDOM.Root | null = null;
  let reviewFormUi: { mount: () => void; remove: () => void } | null = null;
  let mountingReviewForm = false;
  let boundProblemSlug: string | null = null;

  const assistanceSession = createAssistanceSession();
  const evolution = startEvolutionTracking();

  function teardownReviewForm() {
    if (boundProblemSlug) {
      void releaseReviewClaim(boundProblemSlug, clientId);
    }
    reviewFormUi?.remove();
    reviewFormUi = null;
    reactRoot = null;
    mountingReviewForm = false;
    boundProblemSlug = null;
  }

  async function mountReviewForm(options: {
    submissionData: SubmissionPayload;
    attemptId: string;
    prefill?: ReviewFormPrefill;
    recordSkipOnClose?: boolean;
    /** Popup Complete/Edit must remount even after skip/complete for this head. */
    forcePrompt?: boolean;
  }) {
    if (reactRoot !== null || mountingReviewForm) return;
    if (await isMuted()) return;

    const checksum = codeChecksumOf(options.submissionData);
    const claim = await claimReviewPrompt({
      problemSlug: options.submissionData.problemSlug,
      codeChecksum: checksum,
      clientId,
      attemptId: options.attemptId,
      force: options.forcePrompt,
    });
    if (!claim.open) return;

    mountingReviewForm = true;
    const detectedAssistance = assistanceSession.getPrimary();
    const recordSkip = options.recordSkipOnClose !== false;

    const ui = await createShadowRootUi(ctx, {
      name: "leetcode-review-drawer",
      position: "inline",
      anchor: "body",
      onMount(uiContainer) {
        const root = ReactDOM.createRoot(uiContainer);
        reactRoot = root;
        root.render(
          <ReviewForm
            submissionData={options.submissionData}
            detectedAssistance={detectedAssistance}
            prefill={options.prefill}
            onSubmitted={() => {
              assistanceSession.clearAfterSubmit();
              void markReviewCompleted(
                options.submissionData.problemSlug,
                checksum,
              );
            }}
            onSkip={() => {
              if (!recordSkip) return;
              void markReviewSkipped(
                options.submissionData.problemSlug,
                checksum,
              );
              void upsertIncompleteReview({
                problemSlug: options.submissionData.problemSlug,
                submissionData: options.submissionData,
                status: "skipped",
              });
            }}
            onCancel={teardownReviewForm}
          />,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    if (!mountingReviewForm) {
      ui.remove();
      void releaseReviewClaim(options.submissionData.problemSlug, clientId);
      return;
    }
    reviewFormUi = ui;
    mountingReviewForm = false;
    boundProblemSlug = options.submissionData.problemSlug;
    ui.mount();
  }

  async function consumeAcceptedHandoff(
    key: string,
    payload: SubmissionStorageValue,
  ) {
    void browser.storage.local.remove(key);

    if (payload.data.status !== "Accepted") return;

    // Archiving the code timeline is independent of the review UI, so it must
    // happen even while the review drawer is muted.
    evolution.recordAcceptedSubmission({
      problemSlug: payload.data.problemSlug,
      submissionId: key.split(":").pop() ?? "",
      code: payload.data.code ?? null,
      language: payload.data.lang ?? null,
    });

    await mountReviewForm({
      submissionData: payload.data,
      attemptId: key.split(":").pop() ?? crypto.randomUUID(),
    });
  }

  /**
   * After reload the content script has a new clientId, so storage.onChanged
   * for the previous boot never fires here. Reclaim any unconsumed Accepted
   * handoff for the problem currently on screen.
   */
  async function reclaimPendingResults() {
    const slug =
      parseProblemSlugFromPathname(window.location.pathname) ?? null;
    if (!slug) return;

    const pending = await listPendingResultsForProblem(slug);
    // Newest first; consume one Accepted handoff so we do not mount many drawers.
    const handoff = pending[0];
    if (!handoff) return;

    // Drop older orphans for the same problem so they do not linger.
    for (const extra of pending.slice(1)) {
      void browser.storage.local.remove(extra.key);
    }

    await consumeAcceptedHandoff(handoff.key, handoff.value);
  }

  async function maybeOpenRequestedReview() {
    const slug =
      parseProblemSlugFromPathname(window.location.pathname) ?? null;
    if (!slug) return;
    const request = await consumeOpenReviewRequest(slug);
    if (!request) return;
    await mountReviewForm({
      submissionData: request.submissionData,
      attemptId: `open-request:${slug}:${request.requestedAt}`,
      prefill: prefillFromOpenRequest(request),
      recordSkipOnClose: true,
      forcePrompt: true,
    });
  }

  const onNavigate = () => {
    assistanceSession.handleNavigation(window.location.pathname);
    evolution.onNavigate();
    if (
      boundProblemSlug &&
      shouldTeardownReviewForm(window.location.pathname, boundProblemSlug)
    ) {
      teardownReviewForm();
    }
    void maybeOpenRequestedReview();
    void reclaimPendingResults();
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (isAssistanceSignalMessage(event.data, token)) {
      assistanceSession.record(event.data.level, event.data.problemSlug);
      return;
    }

    if (isCodeMilestoneMessage(event.data, token)) {
      evolution.recordMilestone(event.data);
      return;
    }

    if (!isSubmissionInterceptedMessage(event.data, token)) return;

    const difficulty = event.data.difficulty ?? getProblemDifficulty();
    void browser.runtime.sendMessage({
      type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
      clientId: event.data.clientId,
      attemptId: event.data.attemptId,
      problemSlug:
        parseProblemSlugFromPathname(window.location.pathname) ??
        "unknown-problem",
      submissionData: event.data.submissionData,
      difficulty,
      typedCode: event.data.typedCode ?? null,
      lang: event.data.lang ?? null,
      topicTags: event.data.topicTags ?? null,
    });
  };

  const onStorageChanged = async (
    changes: Record<string, { newValue?: unknown }>,
  ) => {
    if (changes[constants.OPEN_REVIEW_REQUEST_KEY]?.newValue) {
      void maybeOpenRequestedReview();
    }

    for (const [key, change] of Object.entries(changes)) {
      const payload = change.newValue as SubmissionStorageValue | undefined;
      // Prefer this tab's clientId, but also accept any ll_result for the
      // current problem (covers races where reclaim and onChanged both see it).
      if (!key.startsWith(constants.STORAGE_PREFIX) || !payload) continue;

      const forThisClient = key.startsWith(
        `${constants.STORAGE_PREFIX}${clientId}:`,
      );
      const forCurrentProblem =
        payload.data.problemSlug ===
        (parseProblemSlugFromPathname(window.location.pathname) ?? "");
      if (!forThisClient && !forCurrentProblem) continue;

      await consumeAcceptedHandoff(key, payload);
    }
  };

  window.addEventListener("message", onMessage);
  browser.storage.local.onChanged.addListener(onStorageChanged);

  const detectorControls = setupAssistanceDetectors((level) =>
    assistanceSession.record(level),
  );
  assistanceSession.handleNavigation(window.location.pathname);

  const script = createBridgeScript(token, clientId);
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();

  void maybeOpenRequestedReview();
  void reclaimPendingResults();

  return {
    onNavigate,
    teardown: () => {
      window.removeEventListener("message", onMessage);
      browser.storage.local.onChanged.removeListener(onStorageChanged);
      detectorControls.teardown();
      evolution.teardown();
      teardownReviewForm();
    },
  };
}

/** Exported for smoke tests that assert reinject + navigate survive. */
export const trackingControllerTestUtils = {
  shouldTeardownReviewForm,
  codeChecksumOf,
};

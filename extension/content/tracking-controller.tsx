import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import ReviewForm from "@/components/ReviewDrawer/ReviewForm";
import constants from "@/constants";
import { setupAssistanceDetectors } from "@/lib/assistance/detectors";
import { createAssistanceSession } from "@/lib/assistance/session";
import {
  isAssistanceLevel,
  type AssistanceLevel,
} from "@/lib/assistance/types";
import {
  getLeetCodeRouteContext,
  parseProblemSlugFromPathname,
} from "@/lib/leetcode/routes";
import { isMuted } from "@/lib/review/mute";
import type {
  SubmissionInterceptedMessage,
  SubmissionStorageValue,
} from "@/types/submission";

interface AssistanceSignalMessage {
  type: string;
  token: string;
  level: AssistanceLevel;
  problemSlug: string | null;
}

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

  function teardownReviewForm() {
    reviewFormUi?.remove();
    reviewFormUi = null;
    reactRoot = null;
    mountingReviewForm = false;
    boundProblemSlug = null;
  }

  const onNavigate = () => {
    assistanceSession.handleNavigation(window.location.pathname);
    if (
      boundProblemSlug &&
      shouldTeardownReviewForm(window.location.pathname, boundProblemSlug)
    ) {
      teardownReviewForm();
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (isAssistanceSignalMessage(event.data, token)) {
      assistanceSession.record(event.data.level, event.data.problemSlug);
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
    for (const [key, change] of Object.entries(changes)) {
      const payload = change.newValue as SubmissionStorageValue | undefined;
      if (
        !key.startsWith(`${constants.STORAGE_PREFIX}${clientId}:`) ||
        !payload
      ) {
        continue;
      }

      void browser.storage.local.remove(key);

      if (payload.data.status !== "Accepted") continue;
      if (await isMuted()) continue;
      if (reactRoot !== null || mountingReviewForm) continue;

      mountingReviewForm = true;
      const detectedAssistance = assistanceSession.getPrimary();

      const ui = await createShadowRootUi(ctx, {
        name: "leetcode-review-drawer",
        position: "inline",
        anchor: "body",
        onMount(uiContainer) {
          const root = ReactDOM.createRoot(uiContainer);
          reactRoot = root;
          root.render(
            <ReviewForm
              submissionData={payload.data}
              detectedAssistance={detectedAssistance}
              onSubmitted={() => assistanceSession.clearAfterSubmit()}
              onCancel={teardownReviewForm}
            />,
          );
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });

      if (!mountingReviewForm) {
        ui.remove();
        continue;
      }
      reviewFormUi = ui;
      mountingReviewForm = false;
      boundProblemSlug = payload.data.problemSlug;
      ui.mount();
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

  return {
    onNavigate,
    teardown: () => {
      window.removeEventListener("message", onMessage);
      browser.storage.local.onChanged.removeListener(onStorageChanged);
      detectorControls.teardown();
      teardownReviewForm();
    },
  };
}

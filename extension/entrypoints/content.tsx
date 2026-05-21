import "@/components/ReviewDrawer/style.css";
import ReactDOM from "react-dom/client";
import ReviewForm from "@/components/ReviewDrawer/ReviewForm";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { SubmissionInterceptedMessage } from "@/types/submission";

import constants from "@/constants";
import type { SubmissionStorageValue } from "@/types/submission";

function getProblemSlug(): string {
  const slug = window.location.pathname.split("/")[2];
  return slug || "unknown-problem";
}
function getProblemDifficulty(): string {
  const diffEl = document.querySelector(
    '[class*="text-difficulty-easy"], [class*="text-difficulty-medium"], [class*="text-difficulty-hard"]',
  );
  return diffEl?.textContent?.trim() ?? "Unknown";
}

function onPathnameChange(handler: () => void) {
  let lastPathname = window.location.pathname;
  const sync = () => {
    const next = window.location.pathname;
    if (next === lastPathname) return;
    lastPathname = next;
    handler();
  };
  window.addEventListener("popstate", sync);
  for (const key of ["pushState", "replaceState"] as const) {
    const origReplace = history.replaceState.bind(history);
    history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      const ret = origReplace(...args);
      queueMicrotask(sync);
      return ret;
    };
  }
}

function createBridgeScript(
  token: string,
  clientId: string
) {
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
  const m = data as Record<string, unknown>;
  return (
    m.type === constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED &&
    m.token === expectedToken &&
    typeof m.clientId === "string" &&
    typeof m.attemptId === "string"
  );
}

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    
    const DEV_PREVIEW = true;
    if (DEV_PREVIEW) {
      const ui = await createShadowRootUi(ctx, {
        name: "leetcode-review-drawer",
        position: "inline",
        anchor: "body",
        onMount(uiContainer) {
          const root = ReactDOM.createRoot(uiContainer);
          root.render(
            <ReviewForm
              submissionData={{
                status: "Accepted",
                problemSlug: "two-sum",
                difficulty: "Easy",
              }}
              solvedAt={Date.now()}
              onCancel={() => {
                ui?.remove();
                root.unmount();
              }}
            />,
          );
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });
      ui.mount();
      return; // skip all real interception logic
    }

    const token = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    let reactRoot: ReactDOM.Root | null = null;
    let reviewFormShell: { remove: () => void } | null = null;

    function teardownReviewForm() {
      reviewFormShell?.remove();
      reviewFormShell = null;
      reactRoot?.unmount();
      reactRoot = null;
    }

    onPathnameChange(() => {
      teardownReviewForm();
    });

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin)
        return;

      if (!isSubmissionInterceptedMessage(event.data, token)) return;

      console.log("🔒 Securely intercepted accepted submission!");

      // Push to background script strictly for processing and storage
      browser.runtime.sendMessage({
        type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
        clientId: event.data.clientId,
        attemptId: event.data.attemptId,
        problemSlug: getProblemSlug(),
        submissionData: event.data.submissionData,
        difficulty: getProblemDifficulty(),
        typedCode: event.data.typedCode ?? null,
        lang: event.data.lang ?? null,
      });
    });

    browser.storage.local.onChanged.addListener(async (changes) => {
      for (const [key, change] of Object.entries(changes)) {
        const payload = change.newValue as SubmissionStorageValue | undefined;
        if (
          !key.startsWith(`${constants.STORAGE_PREFIX}${clientId}:`) ||
          !payload
        )
          continue;

        browser.storage.local.remove(key).catch(console.error);

        if (payload.data.status !== "Accepted") continue;

        if (reactRoot === null) {
          let ReviewFormUI: any;
          ReviewFormUI = await createShadowRootUi(ctx, {
            name: "leetcode-review-drawer",
            position: "inline",
            anchor: "body",
            onMount(uiContainer) {
              reactRoot = ReactDOM.createRoot(uiContainer);
              reactRoot.render(
                <ReviewForm
                  submissionData={payload.data}
                  solvedAt={payload.timestamp}
                  onCancel={() => {
                    teardownReviewForm();
                  }}
                />,
              );
              return reactRoot;
            },
            onRemove: (root) => {
              root?.unmount();
            },
          });
          ReviewFormUI.mount();
        }
      }
    });

    // 5. Inject the secure bridge
    const script = createBridgeScript(token, clientId);

    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove(); // Cleanup DOM immediately
  },
});

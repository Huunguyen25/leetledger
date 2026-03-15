import "@/components/ReviewDrawer/style.css";
import ReactDOM from "react-dom/client";
import ReviewForm from "@/components/ReviewDrawer/ReviewForm";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import constants from "@/constants";
import type { SubmissionStorageValue } from "@/types/submission";

function getProblemSlug(): string {
  const slug = window.location.pathname.split("/")[2];
  return slug || "unknown-problem";
}

function createBridgeScript(
  token: string,
  clientId: string,
  problemSlug: string,
) {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("/fetch-bridge.js");
  script.dataset.token = token;
  script.dataset.clientId = clientId;
  script.dataset.problemSlug = problemSlug;
  return script;
}

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const token = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const problemSlug = getProblemSlug();
    let reactRoot: ReactDOM.Root | null = null;

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin)
        return;

      const { type, token: msgToken } = event.data ?? {};

      if (
        type !== constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED ||
        msgToken !== token
      )
        return;

      console.log("🔒 Securely intercepted accepted submission!");

      // Push to background script strictly for processing and storage
      browser.runtime.sendMessage({
        type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
        clientId: event.data.clientId,
        attemptId: event.data.attemptId,
        problemSlug: event.data.problemSlug,
        submissionData: event.data.submissionData,
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
                  onCancel={() => {
                    console.log("🔒 Review form cancelled");
                    ReviewFormUI?.remove();
                    ReviewFormUI = null;
                    reactRoot?.unmount();
                    reactRoot = null;
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
    const script = createBridgeScript(token, clientId, problemSlug);

    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove(); // Cleanup DOM immediately
  },
});

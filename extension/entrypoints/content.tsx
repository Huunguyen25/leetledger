import "@/components/ReviewDrawer/style.css";
import ReactDOM from "react-dom/client";
import ReviewForm from "@/components/ReviewDrawer/ReviewForm";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { SubmissionInterceptedMessage } from "@/types/submission";

import constants from "@/constants";
import { isMuted } from "@/lib/mute";
import { parseProblemSlugFromPathname } from "@/lib/problem-slug";
import { shouldTeardownReviewForm } from "@/lib/review-drawer-navigation";
import type { SubmissionStorageValue } from "@/types/submission";

function getProblemDifficulty(): string {
  const diffEl = document.querySelector(
    '[class*="text-difficulty-easy"], [class*="text-difficulty-medium"], [class*="text-difficulty-hard"]',
  );
  return diffEl?.textContent?.trim() ?? "Unknown";
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
    
    const DEV_PREVIEW = false;
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
                topicTags: [
                  { name: "Array", slug: "array" },
                  { name: "Hash Table", slug: "hash-table" },
                ],
              }}
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
    let reviewFormUi: { mount: () => void; remove: () => void } | null = null;
    // Guards the async gap between deciding to mount and the UI being ready, so
    // rapid storage changes can't spawn duplicate drawers.
    let mountingReviewForm = false;
    let boundProblemSlug: string | null = null;

    function teardownReviewForm() {
      // ui.remove() triggers onRemove, which unmounts the React root.
      reviewFormUi?.remove();
      reviewFormUi = null;
      reactRoot = null;
      mountingReviewForm = false;
      boundProblemSlug = null;
    }

    // LeetCode is a Next.js SPA whose router calls history.pushState in the
    // page's main world; a content script can't observe that by patching
    // history in its isolated world. WXT's location watcher detects URL changes
    // via the Navigation API (polling fallback). Tear down only when navigation
    // leaves the bound problem (different slug or non-problem route), not on
    // intra-problem tab switches such as Accepted → Code.
    ctx.addEventListener(window, "wxt:locationchange", () => {
      if (
        boundProblemSlug &&
        shouldTeardownReviewForm(window.location.pathname, boundProblemSlug)
      ) {
        teardownReviewForm();
      }
    });

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin)
        return;

      if (!isSubmissionInterceptedMessage(event.data, token)) return;

      console.log("🔒 Securely intercepted accepted submission!");

      // Prefer the GraphQL-sourced difficulty (authoritative); fall back to DOM
      // scrape only when the GraphQL call failed or timed out.
      const difficulty = event.data.difficulty ?? getProblemDifficulty();

      // Push to background script strictly for processing and storage
      browser.runtime.sendMessage({
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

        // Respect a popup-set mute window: still consume the result above so it
        // doesn't pile up in storage, but skip surfacing the review drawer.
        if (await isMuted()) continue;

        if (reactRoot !== null || mountingReviewForm) continue;
        mountingReviewForm = true;

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
                onCancel={teardownReviewForm}
              />,
            );
            return root;
          },
          onRemove: (root) => root?.unmount(),
        });

        // A teardown (navigation/cancel) may have fired during the await above.
        if (!mountingReviewForm) {
          ui.remove();
          continue;
        }
        reviewFormUi = ui;
        mountingReviewForm = false;
        boundProblemSlug = payload.data.problemSlug;
        ui.mount();
      }
    });

    // 5. Inject the secure bridge
    const script = createBridgeScript(token, clientId);

    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove(); // Cleanup DOM immediately
  },
});

import "@/components/ReviewDrawer/style.css";
import ReactDOM from "react-dom/client";
import ReviewForm from "@/components/ReviewDrawer/ReviewForm";

interface SubmissionStoragePayload {
  data: {
    status: string;
    runtime: string;
    memory: string;
    runtimePercentile: number;
    memoryPercentile: number;
    problemSlug: string;
  };
  timestamp: number;
}

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",
  
  async main(ctx) {
    const SECURE_TOKEN = crypto.randomUUID();
    const clientId = crypto.randomUUID();

    const problemSlug = window.location.pathname.split('/')[2] || "unknown-problem";

    let currentUiRoot: ReactDOM.Root | null = null;

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (data?.type === 'LEETCODE_SUBMISSION_INTERCEPTED' && data.token === SECURE_TOKEN) {
        console.log("🔒 Securely intercepted accepted submission!");
        
        // Push to background script strictly for processing and storage
        browser.runtime.sendMessage({
          type: "SUBMISSION_RESULT",
          clientId: data.clientId,
          attemptId: data.attemptId,
          problemSlug: data.problemSlug,
          submissionData: data.submissionData
        });
      }
    });

    browser.storage.local.onChanged.addListener((changes) => {
      for (const [key, change ] of Object.entries(changes)) {
        const payload = change.newValue as SubmissionStoragePayload | undefined;
        if (key.startsWith(`ll_result:${clientId}:`) && payload) {
          // Delete instantly to prevent bloat
          browser.storage.local.remove(key).catch(console.error);
          console.log("📦 State update received, rendering UI:", payload.data);
          // Pass the fresh data into your React component
          if (currentUiRoot) {
            currentUiRoot.render(<ReviewForm />);

          }
        }
      }
    });
  
    const ui = await createShadowRootUi(ctx, {
      name: "leetcode-review-drawer",
      position: "inline",
      anchor: "body",
      onMount(uiContainer) {
        currentUiRoot = ReactDOM.createRoot(uiContainer);
        currentUiRoot.render(<ReviewForm />);
        return currentUiRoot;
      },
      onRemove: (root) => { if (root) root.unmount(); },
    });
    ui.mount();

    // 5. Inject the secure bridge
    const script = document.createElement("script");
    script.src = (browser.runtime.getURL as (path: string) => string)("/inject.js");
    // Pass metadata safely via dataset
    script.dataset.token = SECURE_TOKEN;
    script.dataset.clientId = clientId;
    script.dataset.problemSlug = problemSlug;
    
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove(); // Cleanup DOM immediately

  },
});
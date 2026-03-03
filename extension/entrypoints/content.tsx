import "@/components/ReviewDrawer/style.css";
import ReactDOM from "react-dom/client";
import ReviewForm from "@/components/ReviewDrawer/reviewForm";

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    console.log("ReviewDrawer content script loaded");
    const ui = await createShadowRootUi(ctx, {
      name: "example-ui",
      position: "inline",
      anchor: "body",
      onMount(uiContainer) {
        const root = ReactDOM.createRoot(uiContainer);
        root.render(<ReviewForm />);
        return root;
      },
      onRemove: (root) => {
        if (root) {
          root.unmount();
        }
      },
    });

    browser.runtime.onMessage.addListener((request) => {
      if (request.type === "SHOW_REVIEW_DRAWER") {
        ui.mount();
      }
      return Promise.resolve({ response: "Hi from content script" });
    });
  },
});

import "@/components/page/ReviewDrawer/ReviewDrawer.css";
import "@/components/page/AuthToast/AuthToast.css";
import { startIdentityController } from "@/content/identity-controller";

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    await startIdentityController(ctx);
  },
});

import "@/components/ReviewDrawer/style.css";
import "@/components/AuthToast/style.css";
import { startIdentityController } from "@/content/identity-controller";

export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    await startIdentityController(ctx);
  },
});

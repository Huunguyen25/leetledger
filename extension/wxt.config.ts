import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // 1. Add 'webRequest' to see the traffic
    permissions: ["webRequest", "storage"],

    // 2. Add host permissions so you can fetch the data inside the listener
    host_permissions: ["https://leetcode.com/*", "https://leetcode-cn.com/*"],
  },
});

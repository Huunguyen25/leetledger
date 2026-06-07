import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // Interception is done by wrapping window.fetch in the injected bridge,
    // so only storage is needed (no webRequest).
    permissions: ["storage"],

    // Match the content-script/web-accessible-resource patterns: any
    // leetcode.com subdomain (e.g. www.) over http or https.
    host_permissions: ["*://*.leetcode.com/*"],
    web_accessible_resources: [
      {
        resources: ["/fetch-bridge.js"],
        matches: ["*://*.leetcode.com/*"],
      },
    ],
  },
});

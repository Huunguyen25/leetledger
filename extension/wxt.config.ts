import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Dedicated HMR port (not 3000): constants.DASHBOARD_URL defaults to the
  // Next.js app on :3000. If WXT silently bumps to :3001 while Chrome still
  // has CSP for :3000, popup scripts are blocked and the UI goes blank.
  // Setting port enables strictPort — conflict fails loudly instead.
  dev: {
    server: {
      port: 5173,
      origin: "http://localhost:5173",
    },
  },
  // Force Vite's HMR client onto the same port (avoids stale/default :3000
  // websocket targets after a port change).
  vite: () => ({
    server: {
      hmr: {
        protocol: "ws",
        host: "localhost",
        clientPort: 5173,
      },
    },
  }),
  webExt: {
    startUrls: ["https://leetcode.com"],
    chromiumArgs: [
      '--disable-blink-features=AutomationControlled',
      '--user-data-dir=./.chrome-dev-data'
    ]
  },
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // Interception is done by wrapping window.fetch in the injected bridge,
    // so only storage is needed (no webRequest).
    // "tabs" lets startLogin() focus an existing login tab instead of spawning
    // duplicates when the popup Sign in button is clicked again.
    permissions: ["storage", "tabs"],

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

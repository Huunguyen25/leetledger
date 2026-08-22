import path from "node:path";
import { defineConfig } from "vitest/config";

const liveSupabase = process.env.LIVE_SUPABASE === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: liveSupabase
      ? ["lib/**/*.integration.test.ts"]
      : [
          "background/**/*.test.ts",
          "components/**/*.test.tsx",
          "content/**/*.test.ts",
          "lib/**/*.test.ts",
        ],
    exclude: liveSupabase ? [] : ["lib/**/*.integration.test.ts"],
  },
});

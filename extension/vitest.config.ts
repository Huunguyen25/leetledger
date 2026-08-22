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
      ? ["**/*.integration.test.ts"]
      : ["**/*.test.ts", "**/*.test.tsx"],
    exclude: liveSupabase ? [] : ["**/*.integration.test.ts"],
  },
});

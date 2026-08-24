import { vi } from "vitest";

const storage = new Map<string, unknown>();

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[] | null) => {
          if (key === null) return Object.fromEntries(storage);
          const keys = Array.isArray(key) ? key : [key];
          return Object.fromEntries(
            keys
              .filter((item) => storage.has(item))
              .map((item) => [item, storage.get(item)]),
          );
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, value);
          }
        }),
        remove: vi.fn(async (key: string | string[]) => {
          const keys = Array.isArray(key) ? key : [key];
          for (const item of keys) storage.delete(item);
        }),
        clear: vi.fn(async () => {
          storage.clear();
        }),
      },
    },
  },
}));

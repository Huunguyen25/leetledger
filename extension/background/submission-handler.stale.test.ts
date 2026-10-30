import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

describe("clearStaleResults TTL sweep", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps fresh handoffs and removes expired / legacy keys", async () => {
    const now = 1_700_000_000_000;
    const freshKey = `${constants.STORAGE_PREFIX}client:1`;
    const staleKey = `${constants.STORAGE_PREFIX}client:2`;
    const legacyKey = `${constants.STORAGE_PREFIX}client:3`;
    const otherKey = "ll_mute_until";

    const remove = vi.fn(async (_keys: string[]) => undefined);
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn(async () => ({
            [freshKey]: {
              data: { status: "Accepted", problemSlug: "a", difficulty: "Easy" },
              writtenAt: now - 1_000,
            },
            [staleKey]: {
              data: { status: "Accepted", problemSlug: "b", difficulty: "Easy" },
              writtenAt: now - constants.RESULT_TTL_MS - 1,
            },
            [legacyKey]: {
              data: { status: "Accepted", problemSlug: "c", difficulty: "Easy" },
            },
            [otherKey]: now + 10_000,
          })),
          remove,
        },
      },
    });

    const { clearStaleResults } = await import("./submission-handler");
    const removed = await clearStaleResults(now);

    expect(removed.sort()).toEqual([legacyKey, staleKey].sort());
    expect(remove).toHaveBeenCalledWith(
      expect.arrayContaining([staleKey, legacyKey]),
    );
    const removedArg = remove.mock.calls[0]![0];
    expect(removedArg).not.toContain(freshKey);
    expect(removedArg).not.toContain(otherKey);
  });
});

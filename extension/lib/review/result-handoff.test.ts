import { beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

describe("listPendingResultsForProblem", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns Accepted handoffs for the problem newest-first, any clientId", async () => {
    const now = 1_700_000_000_000;
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn(async () => ({
            [`${constants.STORAGE_PREFIX}old-client:111`]: {
              data: {
                status: "Accepted",
                problemSlug: "two-sum",
                difficulty: "Easy",
              },
              writtenAt: now - 5_000,
            },
            [`${constants.STORAGE_PREFIX}other:222`]: {
              data: {
                status: "Accepted",
                problemSlug: "add-two-numbers",
                difficulty: "Medium",
              },
              writtenAt: now,
            },
            [`${constants.STORAGE_PREFIX}old-client:333`]: {
              data: {
                status: "Accepted",
                problemSlug: "two-sum",
                difficulty: "Easy",
                code: "x",
              },
              writtenAt: now,
            },
          })),
        },
      },
    });

    const { listPendingResultsForProblem } = await import("./result-handoff");
    const pending = await listPendingResultsForProblem("two-sum");

    expect(pending.map((item) => item.attemptId)).toEqual(["333", "111"]);
    expect(pending[0]?.value.data.code).toBe("x");
  });
});

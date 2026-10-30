import { beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

describe("review prompt gate", () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    vi.resetModules();
    stored = {};
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn(async (key?: string) =>
            key ? { [key]: stored[key] } : { ...stored },
          ),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(stored, values);
          }),
          remove: vi.fn(async (key: string) => {
            delete stored[key];
          }),
        },
      },
    });
  });

  it("claims once then blocks sibling tabs and skipped heads", async () => {
    const {
      claimReviewPrompt,
      markReviewSkipped,
      markReviewCompleted,
    } = await import("./prompt-gate");

    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-a",
        attemptId: "1",
      }),
    ).resolves.toEqual({ open: true });

    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-b",
        attemptId: "1",
      }),
    ).resolves.toEqual({ open: false, reason: "opened_elsewhere" });

    await markReviewSkipped("two-sum", "abc");
    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-a",
        attemptId: "2",
      }),
    ).resolves.toEqual({ open: false, reason: "skipped" });

    await markReviewCompleted("two-sum", "abc");
    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-a",
        attemptId: "3",
      }),
    ).resolves.toEqual({ open: false, reason: "recently_completed" });
  });

  it("keeps completed heads past 24h and allows a new checksum", async () => {
    const { claimReviewPrompt, markReviewCompleted } =
      await import("./prompt-gate");

    await markReviewCompleted("two-sum", "abc");
    const state = stored[constants.REVIEW_PROMPT_GATE_KEY] as {
      entries: Array<{ updatedAt: number }>;
    };
    state.entries[0]!.updatedAt = Date.now() - 48 * 60 * 60 * 1000;

    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-a",
        attemptId: "old",
      }),
    ).resolves.toEqual({ open: false, reason: "recently_completed" });

    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "def",
        clientId: "tab-a",
        attemptId: "new-code",
      }),
    ).resolves.toEqual({ open: true });
  });

  it("force bypasses skip/complete for explicit open requests", async () => {
    const { claimReviewPrompt, markReviewSkipped } =
      await import("./prompt-gate");

    await markReviewSkipped("two-sum", "abc");
    await expect(
      claimReviewPrompt({
        problemSlug: "two-sum",
        codeChecksum: "abc",
        clientId: "tab-a",
        attemptId: "open-request",
        force: true,
      }),
    ).resolves.toEqual({ open: true });
  });
});

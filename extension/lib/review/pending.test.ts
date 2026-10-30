import { beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

describe("pending review queue", () => {
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

  it("replaces the same problemSlug and lists pending entries", async () => {
    const {
      enqueuePendingReview,
      listPendingReviews,
      removePendingReview,
    } = await import("./pending");

    const input = {
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      mastery: 3,
      assistance: "NONE" as const,
    };

    await enqueuePendingReview(input);
    await enqueuePendingReview({ ...input, mastery: 5 });

    const listed = await listPendingReviews();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.input.mastery).toBe(5);
    expect(stored[constants.PENDING_REVIEWS_KEY]).toHaveLength(1);

    await removePendingReview("two-sum");
    expect(await listPendingReviews()).toEqual([]);
  });
});

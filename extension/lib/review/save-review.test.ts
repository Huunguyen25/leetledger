import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueuePendingReview, removeIncompleteReview } = vi.hoisted(() => ({
  enqueuePendingReview: vi.fn(async () => undefined),
  removeIncompleteReview: vi.fn(async () => undefined),
}));

vi.mock("./pending", () => ({
  enqueuePendingReview,
}));

vi.mock("./incomplete", () => ({
  removeIncompleteReview,
}));

vi.mock("./cache", () => ({
  clearHistoryCache: vi.fn(async () => undefined),
  getHistoryCache: vi.fn(async () => null),
  setHistoryCache: vi.fn(async () => undefined),
}));

describe("saveReview offline queue", () => {
  beforeEach(() => {
    vi.resetModules();
    enqueuePendingReview.mockClear();
    removeIncompleteReview.mockClear();
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("queues locally when offline without calling upsert", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseClient: () => {
        throw new Error("should not hit supabase while offline");
      },
    }));

    const { saveReview } = await import("./repository");
    const result = await saveReview({
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      mastery: 2,
      assistance: "NONE",
    });

    expect(result).toEqual({ success: true, offline: true });
    expect(enqueuePendingReview).toHaveBeenCalledOnce();
  });

  it("queues on transient upsert failure", async () => {
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: "u1" } } },
            error: null,
          }),
        },
        from: () => ({
          upsert: async () => ({ error: { message: "Failed to fetch" } }),
        }),
      }),
    }));

    const { saveReview } = await import("./repository");
    const result = await saveReview({
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      mastery: 2,
      assistance: "NONE",
    });

    expect(result).toEqual({ success: true, offline: true });
    expect(enqueuePendingReview).toHaveBeenCalledOnce();
  });
});

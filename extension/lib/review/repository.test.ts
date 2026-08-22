import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, upsert, from, clearHistoryCache } = vi.hoisted(() => {
  const getUser = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn(() => ({ upsert }));
  const clearHistoryCache = vi.fn();
  return { getUser, upsert, from, clearHistoryCache };
});

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({ auth: { getUser }, from }),
}));
vi.mock("./cache", () => ({
  clearHistoryCache,
  getHistoryCache: vi.fn(),
  setHistoryCache: vi.fn(),
}));

import { upsertReview } from "./repository";

const input = {
  problemSlug: "two-sum",
  problemTitle: "Two Sum",
  difficulty: "Easy",
  mastery: 3,
  assistance: "NONE" as const,
  timeComplexity: "O(n)",
  spaceComplexity: "O(n)",
  topicTags: [
    { name: "Array", slug: "array" },
    { name: "Hash Table", slug: "hash-table" },
  ],
  questionId: 1,
  notes: "  Map complements  ",
};

describe("upsertReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "ci-user" } },
      error: null,
    });
    upsert.mockResolvedValue({ error: null });
  });

  it("maps form input to the database contract and clears stale history", async () => {
    await expect(upsertReview(input)).resolves.toEqual({ success: true });

    expect(from).toHaveBeenCalledWith("reviews");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "ci-user",
        problem_slug: "two-sum",
        problem_title: "Two Sum",
        leetcode_difficulty: "Easy",
        mastery: 3,
        assistance: "NONE",
        time_complexity: "O(n)",
        space_complexity: "O(n)",
        topic_tags: ["array", "hash-table"],
        question_id: 1,
        notes: "Map complements",
      },
      { onConflict: "user_id,problem_slug" },
    );
    expect(clearHistoryCache).toHaveBeenCalledOnce();
  });

  it("converts empty optional fields to null", async () => {
    await upsertReview({
      ...input,
      timeComplexity: undefined,
      spaceComplexity: undefined,
      topicTags: undefined,
      questionId: null,
      notes: "   ",
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        time_complexity: null,
        space_complexity: null,
        topic_tags: null,
        question_id: null,
        notes: null,
      }),
      expect.anything(),
    );
  });

  it("does not write when there is no signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(upsertReview(input)).resolves.toEqual({
      success: false,
      error: "Not signed in",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the authentication error", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });

    await expect(upsertReview(input)).resolves.toEqual({
      success: false,
      error: "JWT expired",
    });
  });

  it("returns the database error and keeps the cache", async () => {
    upsert.mockResolvedValue({ error: { message: "RLS denied the write" } });

    await expect(upsertReview(input)).resolves.toEqual({
      success: false,
      error: "RLS denied the write",
    });
    expect(clearHistoryCache).not.toHaveBeenCalled();
  });
});

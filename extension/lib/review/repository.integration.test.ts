import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/client";
import { upsertReview } from "./repository";

const email = process.env.CI_SUPABASE_EMAIL;
const password = process.env.CI_SUPABASE_PASSWORD;

if (!email || !password) {
  throw new Error("CI_SUPABASE_EMAIL and CI_SUPABASE_PASSWORD are required");
}

const supabase = getSupabaseClient();
const slug = "ci-review-upsert-fixture";

describe("review upsert against Supabase", () => {
  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  });

  afterAll(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("reviews").delete().eq("user_id", user.id).eq("problem_slug", slug);
    }
    await supabase.auth.signOut();
  });

  it("creates and then updates the same user/problem row", async () => {
    const base = {
      problemSlug: slug,
      problemTitle: "CI Review Upsert Fixture",
      difficulty: "Easy",
      assistance: "NONE" as const,
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      topicTags: [{ name: "Array", slug: "array" }],
      questionId: 9_999_999,
    };

    await expect(upsertReview({ ...base, mastery: 2, notes: "first write" }))
      .resolves.toEqual({ success: true });
    await expect(upsertReview({ ...base, mastery: 5, notes: "updated write" }))
      .resolves.toEqual({ success: true });

    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeTruthy();

    const { data, error } = await supabase
      .from("reviews")
      .select("problem_slug, mastery, notes, time_complexity, space_complexity, topic_tags")
      .eq("user_id", user!.id)
      .eq("problem_slug", slug)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      problem_slug: slug,
      mastery: 5,
      notes: "updated write",
      time_complexity: "O(n)",
      space_complexity: "O(1)",
      topic_tags: ["array"],
    });
  });
});

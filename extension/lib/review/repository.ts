import { getSupabaseClient } from "@/lib/supabase/client";
import {
  clearHistoryCache,
  getHistoryCache,
  setHistoryCache,
} from "./cache";
import type {
  ListReviewsCachedResult,
  ListReviewsResult,
  ReviewInput,
  ReviewResult,
  SolvedReview,
} from "./types";

export type {
  ListReviewsCachedResult,
  ListReviewsResult,
  ReviewInput,
  ReviewResult,
  SolvedReview,
} from "./types";

const supabase = getSupabaseClient();

/**
 * Inserts or updates the signed-in user's review. Server-side triggers own the
 * scheduling fields, so this repository writes only user-supplied review data.
 */
export async function upsertReview(input: ReviewInput): Promise<ReviewResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: authError?.message ?? "Not signed in" };
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      problem_slug: input.problemSlug,
      problem_title: input.problemTitle,
      leetcode_difficulty: input.difficulty,
      mastery: input.mastery,
      assistance: input.assistance,
      time_complexity: input.timeComplexity ?? null,
      space_complexity: input.spaceComplexity ?? null,
      topic_tags: input.topicTags?.map((tag) => tag.slug) ?? null,
      question_id: input.questionId ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
    { onConflict: "user_id,problem_slug" },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  await clearHistoryCache();
  return { success: true };
}

/** Lists the user's most recently solved problems, newest first. */
export async function listReviews(limit = 25): Promise<ListReviewsResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: authError?.message ?? "Not signed in" };
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "problem_slug, problem_title, leetcode_difficulty, mastery, question_id, last_solved_at, next_review_date",
    )
    .eq("user_id", user.id)
    .order("last_solved_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  const reviews: SolvedReview[] = (data ?? []).map((row) => ({
    problemSlug: row.problem_slug,
    problemTitle: row.problem_title,
    difficulty: row.leetcode_difficulty,
    mastery: row.mastery,
    questionId: row.question_id,
    lastSolvedAt: row.last_solved_at,
    nextReviewDate: row.next_review_date,
  }));

  return { success: true, reviews };
}

/** Loads solved history using a stale-while-revalidate browser cache. */
export async function listReviewsCached(
  userId: string,
  options?: { force?: boolean },
): Promise<ListReviewsCachedResult> {
  if (!options?.force) {
    const cached = await getHistoryCache(userId);
    if (cached?.fresh) {
      return {
        success: true,
        reviews: cached.reviews,
        fromCache: true,
        needsRefresh: false,
      };
    }
    if (cached) {
      return {
        success: true,
        reviews: cached.reviews,
        fromCache: true,
        needsRefresh: true,
      };
    }
  }

  const result = await listReviews();
  if (!result.success) {
    if (!options?.force) {
      const cached = await getHistoryCache(userId);
      if (cached) {
        return { success: false, error: result.error, reviews: cached.reviews };
      }
    }
    return { success: false, error: result.error };
  }

  await setHistoryCache(userId, result.reviews);
  return {
    success: true,
    reviews: result.reviews,
    fromCache: false,
    needsRefresh: false,
  };
}

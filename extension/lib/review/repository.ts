import { getSupabaseClient } from "@/lib/supabase/client";
import {
  cappedMasteryForSrs,
  isAssistanceLevel,
} from "@/lib/assistance/types";
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

/**
 * Normalizes user-supplied review fields before persist. Mastery is always
 * clamped to the assistance SRS cap here so UI/devtools edits cannot write an
 * uncapped value through this repository path.
 */
export function normalizeReviewInput(input: ReviewInput): ReviewInput | null {
  if (!isAssistanceLevel(input.assistance)) return null;
  if (!Number.isFinite(input.mastery)) return null;

  const bounded = Math.max(1, Math.min(10, Math.round(input.mastery)));
  return {
    ...input,
    assistance: input.assistance,
    mastery: cappedMasteryForSrs(bounded, input.assistance),
  };
}

/**
 * Inserts or updates the signed-in user's review. Server-side triggers own the
 * scheduling fields, so this repository writes only user-supplied review data.
 */
export async function upsertReview(input: ReviewInput): Promise<ReviewResult> {
  const normalized = normalizeReviewInput(input);
  if (!normalized) {
    return { success: false, error: "Invalid review input" };
  }

  const supabase = getSupabaseClient();
  // Prefer getSession() over getUser(): getUser() always round-trips to Auth
  // and can stall for tens of seconds on refresh. The subsequent query/upsert
  // still sends the JWT, so an expired session fails at the API anyway.
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return { success: false, error: authError?.message ?? "Not signed in" };
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      problem_slug: normalized.problemSlug,
      problem_title: normalized.problemTitle,
      leetcode_difficulty: normalized.difficulty,
      mastery: normalized.mastery,
      assistance: normalized.assistance,
      time_complexity: normalized.timeComplexity ?? null,
      space_complexity: normalized.spaceComplexity ?? null,
      topic_tags: normalized.topicTags?.map((tag) => tag.slug) ?? null,
      question_id: normalized.questionId ?? null,
      notes: normalized.notes?.trim() ? normalized.notes.trim() : null,
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
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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

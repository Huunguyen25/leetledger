import {
  getHistoryCache,
  setHistoryCache,
} from "@/lib/history-cache";
import { createClient } from "./client";
import type { TopicTag } from "@/types/submission";

const supabase = createClient();

export type AssistanceLevel = "NONE" | "LOGIC_PEEK" | "SOLUTION_COPIED";

/**
 * The human-supplied half of a review. Everything in this shape is written
 * directly; the SRS columns (repetition_count, previous_interval,
 * next_review_date, last_solved_at) are intentionally omitted because the
 * `calculate_srs_metrics` BEFORE INSERT/UPDATE trigger computes them server-side.
 */
export interface ReviewInput {
  problemSlug: string;
  problemTitle: string;
  difficulty: string;
  mastery: number;
  assistance: AssistanceLevel;
  timeComplexity?: string;
  spaceComplexity?: string;
  topicTags?: TopicTag[];
  questionId?: number | null;
  notes?: string;
}

type ReviewResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Inserts or updates the user's review for a problem. The unique index on
 * (user_id, problem_slug) means re-solving the same problem updates the
 * existing row, which is exactly what lets the SRS trigger read the previous
 * interval / repetition count and advance the schedule.
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
      topic_tags: input.topicTags?.map((t) => t.slug) ?? null,
      question_id: input.questionId ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
    { onConflict: "user_id,problem_slug" },
  );

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** A previously-reviewed problem, shaped for the popup's solved history list. */
export interface SolvedReview {
  problemSlug: string;
  problemTitle: string;
  difficulty: string;
  mastery: number;
  questionId: number | null;
  /** When the problem was last solved (set server-side by the SRS trigger). */
  lastSolvedAt: string | null;
  /** Next scheduled revisit date (set server-side by the SRS trigger). */
  nextReviewDate: string | null;
}

type ListReviewsResult =
  | { success: true; reviews: SolvedReview[] }
  | { success: false; error: string };

/**
 * Lists the signed-in user's most recently solved problems, newest first.
 * Row-level security already scopes reads to the current user; the explicit
 * user_id filter keeps the query intent obvious and survives any RLS gap.
 */
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

export type ListReviewsCachedResult =
  | {
      success: true;
      reviews: SolvedReview[];
      fromCache: boolean;
      needsRefresh: boolean;
    }
  | { success: false; error: string; reviews?: SolvedReview[] };

/**
 * Loads solved history with stale-while-revalidate caching.
 * Fresh cache skips the network; stale cache returns immediately and sets
 * needsRefresh so the caller can fetch in the background.
 */
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

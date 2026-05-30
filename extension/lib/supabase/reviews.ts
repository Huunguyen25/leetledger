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

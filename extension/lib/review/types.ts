import type { AssistanceLevel } from "@/lib/assistance/types";
import type { TopicTag } from "@/types/submission";

/** The user-supplied fields persisted when a problem is reviewed. */
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

/** A previously reviewed problem displayed in solved history. */
export interface SolvedReview {
  problemSlug: string;
  problemTitle: string;
  difficulty: string;
  mastery: number;
  questionId: number | null;
  lastSolvedAt: string | null;
  nextReviewDate: string | null;
}

export type ReviewResult =
  | { success: true }
  | { success: false; error: string };

export type ListReviewsResult =
  | { success: true; reviews: SolvedReview[] }
  | { success: false; error: string };

export type ListReviewsCachedResult =
  | {
      success: true;
      reviews: SolvedReview[];
      fromCache: boolean;
      needsRefresh: boolean;
    }
  | { success: false; error: string; reviews?: SolvedReview[] };

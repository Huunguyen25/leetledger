import type {
  AssistanceLevel,
  ProblemReview,
  ReviewStatus,
  TopicStat,
} from "./types";

const DAY = 86_400_000;
export const DUE_SOON_DAYS = 3;

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  scheduled: "Scheduled",
  unscheduled: "Unscheduled",
};

export const ASSISTANCE_LABEL: Record<AssistanceLevel, string> = {
  NONE: "None",
  HINT: "Hint",
  SOLUTION_PEEK: "Solution peek",
  SOLUTION_COPIED: "Solution copy",
};

export const ASSISTANCE_CAP: Record<AssistanceLevel, number> = {
  NONE: 10,
  HINT: 7,
  SOLUTION_PEEK: 4,
  SOLUTION_COPIED: 1,
};

export function startOfLocalDay(now = new Date()) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function reviewStatus(
  nextReviewDate: string | null,
  now = new Date(),
): ReviewStatus {
  if (!nextReviewDate) return "unscheduled";
  const next = new Date(nextReviewDate);
  if (Number.isNaN(next.getTime())) return "unscheduled";

  const today = startOfLocalDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const soonEnd = new Date(today.getTime() + (DUE_SOON_DAYS + 1) * DAY);
  if (next < today) return "overdue";
  if (next < tomorrow) return "today";
  if (next < soonEnd) return "soon";
  return "scheduled";
}

export function formatReviewDate(value: string | null, now = new Date()) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const status = reviewStatus(value, now);
  if (status === "today") return "Today";

  const difference = Math.round(
    (startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / DAY,
  );
  if (difference === 1) return "Tomorrow";
  if (difference === -1) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function effectiveMastery(review: ProblemReview) {
  return Math.min(review.mastery, ASSISTANCE_CAP[review.assistance]);
}

export function topicStats(problems: ProblemReview[]): TopicStat[] {
  const stats = new Map<
    string,
    { total: number; count: number; due: number; assisted: number }
  >();

  for (const problem of problems) {
    for (const topic of problem.topicTags) {
      const current = stats.get(topic) ?? {
        total: 0,
        count: 0,
        due: 0,
        assisted: 0,
      };
      current.total += problem.mastery;
      current.count += 1;
      if (["overdue", "today"].includes(reviewStatus(problem.nextReviewDate))) {
        current.due += 1;
      }
      if (problem.assistance !== "NONE") current.assisted += 1;
      stats.set(topic, current);
    }
  }

  return [...stats].map(([name, value]) => ({
    name,
    average: value.total / value.count,
    count: value.count,
    due: value.due,
    assisted: value.assisted,
  }));
}

export function compareByReviewDate(a: ProblemReview, b: ProblemReview) {
  if (!a.nextReviewDate) return 1;
  if (!b.nextReviewDate) return -1;
  return (
    new Date(a.nextReviewDate).getTime() -
    new Date(b.nextReviewDate).getTime()
  );
}

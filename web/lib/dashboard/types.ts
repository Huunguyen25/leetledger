export type AssistanceLevel =
  | "NONE"
  | "HINT"
  | "SOLUTION_PEEK"
  | "SOLUTION_COPIED";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type ReviewStatus =
  | "overdue"
  | "today"
  | "soon"
  | "scheduled"
  | "unscheduled";

export interface ProblemReview {
  id: number;
  questionId: number;
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  mastery: number;
  assistance: AssistanceLevel;
  topicTags: string[];
  lastSolvedAt: string;
  nextReviewDate: string | null;
  timeComplexity: string;
  spaceComplexity: string;
  notes: string;
}

export type EvolutionEventKind =
  | "checkpoint"
  | "autosave"
  | "run"
  | "submit";

export interface EvolutionEvent {
  sequence: number;
  kind: EvolutionEventKind;
  timestamp: string;
  code: string;
}

export interface SubmissionArchive {
  problemSlug: string;
  sessionId: string;
  language: string;
  startedAt: number;
  acceptedAt: number;
  storagePath: string;
  events: EvolutionEvent[];
}

export interface TopicStat {
  name: string;
  average: number;
  count: number;
  due: number;
  assisted: number;
}

export interface ProfileDefinition {
  id: string;
  name: string;
  type: "Built-in" | "Future" | "Custom";
  description: string;
  topics: string[];
}

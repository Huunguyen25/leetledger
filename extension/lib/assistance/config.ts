/**
 * Single tweak point for assistance levels, labels, SRS weights, and detection.
 *
 * Supabase `calculate_srs_metrics` should mirror ASSISTANCE_SRS_WEIGHTS and
 * use LEAST(mastery, cap) via cappedMasteryForSrs().
 * Migration backfill (if you had the 6-value enum):
 *   UPDATE reviews SET assistance = 'HINT' WHERE assistance = 'LOGIC_PEEK';
 *   UPDATE reviews SET assistance = 'SOLUTION_PEEK'
 *     WHERE assistance IN ('GPT_HELP', 'OUTSIDE_SOURCE');
 */

/** Max mastery credit per assistance level; SRS uses LEAST(slider, cap). */
export const ASSISTANCE_SRS_WEIGHTS = {
  NONE: 10,
  HINT: 7,
  SOLUTION_PEEK: 4,
  SOLUTION_COPIED: 1,
} as const;

export type AssistanceLevel = keyof typeof ASSISTANCE_SRS_WEIGHTS;

/**
 * Effective mastery for SRS spacing: slider value capped by assistance tier.
 * Mirrors Supabase `calculate_srs_metrics` (LEAST(mastery, cap)).
 */
export function cappedMasteryForSrs(
  sliderMastery: number,
  assistance: AssistanceLevel,
): number {
  return Math.min(sliderMastery, ASSISTANCE_SRS_WEIGHTS[assistance]);
}

/** Dropdown: value = DB enum, label = user-facing text. */
export const ASSISTANCE_OPTIONS: ReadonlyArray<{
  value: AssistanceLevel;
  label: string;
  /** Detectors may auto-set this; user can always override in ReviewForm. */
  autoDetectable: boolean;
}> = [
  { value: "NONE", label: "None", autoDetectable: false },
  { value: "HINT", label: "Hint", autoDetectable: true },
  {
    value: "SOLUTION_PEEK",
    label: "Solution Peek",
    autoDetectable: true,
  },
  {
    value: "SOLUTION_COPIED",
    label: "Solution Copy",
    autoDetectable: false,
  },
];

/**
 * When multiple signals fire in one attempt, pick the most significant
 * (lower SRS weight = more help used). SOLUTION_COPIED is manual-only.
 */
export const AUTO_DETECT_PRECEDENCE: readonly AssistanceLevel[] = [
  "SOLUTION_PEEK",
  "HINT",
];

/**
 * `/problems/{slug}/{tab}/...` segments that count as Solution Peek:
 * editorial, community solutions, and your prior submissions tab.
 */
export const SOLUTION_PEEK_PATH_TABS = [
  "editorial",
  "solutions",
  "submissions",
] as const;

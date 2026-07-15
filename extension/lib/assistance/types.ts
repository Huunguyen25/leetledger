import {
  ASSISTANCE_OPTIONS,
  AUTO_DETECT_PRECEDENCE,
  type AssistanceLevel,
} from "./config";

export type { AssistanceLevel };
export {
  ASSISTANCE_OPTIONS,
  ASSISTANCE_SRS_WEIGHTS,
  cappedMasteryForSrs,
} from "./config";

const ASSISTANCE_VALUES = new Set<string>(
  ASSISTANCE_OPTIONS.map((option) => option.value),
);

export function isAssistanceLevel(value: unknown): value is AssistanceLevel {
  return typeof value === "string" && ASSISTANCE_VALUES.has(value);
}

/** Picks the single most significant auto-detected level for form prefill. */
export function pickPrimaryAssistance(
  signals: Iterable<AssistanceLevel>,
): AssistanceLevel {
  const detected = new Set(signals);
  for (const level of AUTO_DETECT_PRECEDENCE) {
    if (detected.has(level)) return level;
  }
  return "NONE";
}
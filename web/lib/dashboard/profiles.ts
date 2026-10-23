import type { ProfileDefinition } from "./types";

/**
 * The reviews schema has no profile tables yet. General Practice is therefore
 * the only real profile: it means no additional filtering or weighting.
 */
export const PROFILES: ProfileDefinition[] = [
  {
    id: "general",
    name: "General Practice",
    type: "Built-in",
    description: "All tracked reviews, without company-specific weighting.",
    topics: [],
  },
];

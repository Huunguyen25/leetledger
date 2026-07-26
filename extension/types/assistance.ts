/**
 * Assistance values that may cross page, content-script, storage, and API
 * boundaries. Keep this union aligned with the persisted database enum.
 */
export type AssistanceLevel =
  | "NONE"
  | "HINT"
  | "SOLUTION_PEEK"
  | "SOLUTION_COPIED";

/** Page-world assistance signal posted to the content script. */
export interface AssistanceSignalMessage {
  type: string;
  token: string;
  clientId: string;
  level: AssistanceLevel;
  problemSlug: string | null;
  timestamp: number;
}

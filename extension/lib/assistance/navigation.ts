import { parseProblemSlugFromPathname } from "@/lib/leetcode/routes";
import { SOLUTION_PEEK_PATH_TABS } from "./config";
import type { AssistanceLevel } from "./types";

const SOLUTION_PEEK_TABS = new Set<string>(SOLUTION_PEEK_PATH_TABS);

/**
 * Classifies a problem pathname into an assistance signal, or null. Only the
 * "looking at answers" sub-tabs map to SOLUTION_PEEK; the description tab and
 * non-problem routes return null.
 */
export function classifyAssistancePath(
  pathname: string,
): AssistanceLevel | null {
  if (!parseProblemSlugFromPathname(pathname)) return null;
  const parts = pathname.split("/");
  const tab = parts[3];
  if (tab && SOLUTION_PEEK_TABS.has(tab)) return "SOLUTION_PEEK";
  return null;
}

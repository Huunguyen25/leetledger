import { browser } from "wxt/browser";
import constants from "@/constants";

/**
 * Slug → questionId map in extension storage. Content scripts may read it;
 * writers must go through the background queue so concurrent tabs cannot
 * clobber each other's merge.
 */

export async function readQuestionIdMap(): Promise<Record<string, string>> {
  try {
    const stored = await browser.storage.local.get(
      constants.PROBLEM_ID_MAP_KEY,
    );
    const map = stored[constants.PROBLEM_ID_MAP_KEY];
    return typeof map === "object" && map !== null
      ? (map as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/** One read → merge → write. Callers that need concurrency safety must serialize. */
export async function mergeQuestionId(
  problemSlug: string,
  questionId: string,
): Promise<void> {
  const current = await readQuestionIdMap();
  await browser.storage.local.set({
    [constants.PROBLEM_ID_MAP_KEY]: {
      ...current,
      [problemSlug]: questionId,
    },
  });
}

/** The LeetCode route kinds that affect an active problem attempt. */
export type LeetCodeRouteContext =
  | { kind: "problem"; slug: string }
  | { kind: "submission_detail" }
  | { kind: "other" };

/** Extracts a problem slug from `/problems/{slug}/` pathnames. */
export function parseProblemSlugFromPathname(
  pathname: string,
): string | null {
  const parts = pathname.split("/");
  return parts[1] === "problems" && parts[2] ? parts[2] : null;
}

/** Classifies navigation while preserving submission-detail result views. */
export function getLeetCodeRouteContext(
  pathname: string,
): LeetCodeRouteContext {
  const slug = parseProblemSlugFromPathname(pathname);
  if (slug) return { kind: "problem", slug };
  if (pathname.startsWith("/submissions/detail/")) {
    return { kind: "submission_detail" };
  }
  return { kind: "other" };
}

const SUBMISSION_ID_PATTERN = /\/submissions\/detail\/([^/]+)\/(?:v\d+\/)?check\//;
const NUMERIC_SUBMISSION_ID_PATTERN = /^\d+$/;

/** Extracts the attempt ID from a LeetCode submission-check URL. */
export function extractSubmissionId(url: string): string | null {
  return url.match(SUBMISSION_ID_PATTERN)?.[1] ?? null;
}

/** Excludes non-numeric IDs produced by Run Code and custom test cases. */
export function isValidSubmissionId(submissionId: string): boolean {
  return NUMERIC_SUBMISSION_ID_PATTERN.test(submissionId);
}

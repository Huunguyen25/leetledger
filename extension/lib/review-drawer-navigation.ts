import { parseProblemSlugFromPathname } from "@/lib/problem-slug";

/**
 * Whether a SPA navigation should tear down the review drawer bound to `boundSlug`.
 * Closes on a different problem or when the user leaves the problem flow; stays open
 * for same-problem tab switches and submission-detail result views.
 */
export function shouldTeardownReviewForm(
  pathname: string,
  boundSlug: string,
): boolean {
  const slug = parseProblemSlugFromPathname(pathname);
  if (slug) return slug !== boundSlug;
  if (pathname.startsWith("/submissions/detail/")) return false;
  return true;
}

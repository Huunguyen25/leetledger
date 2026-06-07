/** Extract LeetCode problem slug from a pathname (e.g. /problems/two-sum/ → two-sum). */
export function parseProblemSlugFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  if (parts[1] === "problems" && parts[2]) return parts[2];
  return null;
}

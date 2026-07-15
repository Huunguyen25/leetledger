import type { AssistanceLevel } from "./types";

/**
 * Classifies a LeetCode network request into an assistance signal, or null when
 * it carries no assistance meaning. Pure and dependency-free so the page-world
 * fetch-bridge can import it.
 *
 * Detection is intentionally conservative to avoid false positives:
 * - Reading the official editorial or opening a single community solution
 *   article counts as a Solution Peek.
 * - Merely listing community solutions (browsing titles) does NOT count.
 * - Ask Leet / AI assistant counts as Solution Peek (same tier as editorial).
 */
export function classifyAssistanceRequest(
  url: string,
  operationName: string | null,
): AssistanceLevel | null {
  const op = (operationName ?? "").toLowerCase();
  const target = url.toLowerCase();

  // Ask Leet / AI — merged into SOLUTION_PEEK; click fallback in detectors.ts.
  if (
    op.includes("askleet") ||
    op.includes("aiassist") ||
    op.includes("chatcompletion") ||
    target.includes("/chat/") ||
    target.includes("/ai/")
  ) {
    return "SOLUTION_PEEK";
  }

  // Official editorial.
  if (op.includes("officialsolution") || op.includes("editorial")) {
    return "SOLUTION_PEEK";
  }

  // A single community solution article read (singular), but not the list
  // ("...solutionArticles"). Checking the plural first keeps browsing quiet.
  if (op.includes("solutionarticles")) return null;
  if (op.includes("solutionarticle") || op.includes("solutiondetail")) {
    return "SOLUTION_PEEK";
  }

  return null;
}

/** Best-effort extraction of a GraphQL operationName from a fetch body. */
export function extractOperationName(body: unknown): string | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as { operationName?: unknown };
    return typeof parsed.operationName === "string"
      ? parsed.operationName
      : null;
  } catch {
    return null;
  }
}

import {
  getLeetCodeRouteContext,
  parseProblemSlugFromPathname,
} from "@/lib/leetcode/routes";
import { classifyAssistancePath } from "./navigation";
import { pickPrimaryAssistance, type AssistanceLevel } from "./types";

export interface AssistanceSessionOptions {
  /** Called whenever signals are cleared (nav reset, rebind, or post-submit). */
  onReset?: () => void;
  /** Override for tests; defaults to window.location.pathname. */
  getPathname?: () => string;
}

export interface AssistanceSession {
  handleNavigation(pathname: string): void;
  record(level: AssistanceLevel, slug?: string | null): void;
  getPrimary(): AssistanceLevel;
  clearAfterSubmit(): void;
  reset(): void;
}

/**
 * Tracks assistance signals for a single active problem attempt. Navigation
 * rebinds or clears the session so each problem visit starts fresh.
 */
export function createAssistanceSession(
  options: AssistanceSessionOptions = {},
): AssistanceSession {
  let activeSlug: string | null = null;
  const signals = new Set<AssistanceLevel>();
  const getPathname =
    options.getPathname ?? (() => window.location.pathname);

  function notifyReset() {
    options.onReset?.();
  }

  function bindProblem(slug: string) {
    if (activeSlug === slug) return;
    activeSlug = slug;
    signals.clear();
    notifyReset();
  }

  function reset() {
    if (activeSlug === null && signals.size === 0) return;
    activeSlug = null;
    signals.clear();
    notifyReset();
  }

  return {
    handleNavigation(pathname) {
      const ctx = getLeetCodeRouteContext(pathname);
      if (ctx.kind === "submission_detail") return;
      if (ctx.kind === "other") {
        reset();
        return;
      }
      bindProblem(ctx.slug);
      // Opening the editorial/solutions/submissions tab for the active problem
      // is itself a solution peek. URL-based detection replaces brittle GraphQL
      // operationName matching. activeSlug === ctx.slug here, so add directly.
      const pathSignal = classifyAssistancePath(pathname);
      if (pathSignal) signals.add(pathSignal);
    },

    record(level, slug) {
      const resolvedSlug =
        slug ?? parseProblemSlugFromPathname(getPathname());
      if (!resolvedSlug || resolvedSlug !== activeSlug) return;
      signals.add(level);
    },

    getPrimary() {
      return pickPrimaryAssistance(signals);
    },

    clearAfterSubmit() {
      signals.clear();
      activeSlug = null;
      notifyReset();
    },

    reset,
  };
}

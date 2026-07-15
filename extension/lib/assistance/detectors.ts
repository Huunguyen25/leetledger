import type { AssistanceLevel } from "./types";

/**
 * Content-script detectors for signals with no reliable URL hook:
 * - Hint: expanding a hint disclosure (no network request).
 * - Solution Peek: clicking "Ask Leet" (merged with editorial/path peek).
 */

function onProblemPage(): boolean {
  return window.location.pathname.startsWith("/problems/");
}

/** Heuristic: was a hint header/disclosure (e.g. "Hint 1") clicked? */
function isHintToggle(target: Element): boolean {
  let node: Element | null = target;
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    const text = node.textContent?.trim() ?? "";
    if (text.length > 0 && text.length < 40 && /^hint\b\s*\d*$/i.test(text)) {
      return true;
    }
  }
  return false;
}

export interface AssistanceDetectorControls {
  teardown: () => void;
}

/** Wires click-based assistance detectors; dedupe via AssistanceSession. */
export function setupAssistanceDetectors(
  onSignal: (level: AssistanceLevel) => void,
): AssistanceDetectorControls {
  const onClick = (event: Event) => {
    const target = event.target as Element | null;
    if (!target || !onProblemPage()) return;

    if (target.closest('[aria-label="Ask Leet"]')) {
      onSignal("SOLUTION_PEEK");
      return;
    }
    if (isHintToggle(target)) {
      onSignal("HINT");
    }
  };

  document.addEventListener("click", onClick, true);

  return {
    teardown: () => document.removeEventListener("click", onClick, true),
  };
}

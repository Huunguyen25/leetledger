import type { IdentityFailureReason } from "./types";

/** Reasons that warrant surfacing the auth toast (network-only failures are transient). */
const TOAST_WORTHY_REASONS: IdentityFailureReason[] = [
  "extension_signed_out",
  "leetcode_signed_out",
];

/**
 * Stable de-duplication key for a signed-out toast, derived from the set of
 * toast-worthy failing checkers. Returns null when nothing warrants a toast,
 * so the same combination of failures never re-notifies on every navigation.
 */
export function authToastKey(reasons: IdentityFailureReason[]): string | null {
  const relevant = reasons
    .filter((reason) => TOAST_WORTHY_REASONS.includes(reason))
    .sort();
  return relevant.length > 0 ? relevant.join("|") : null;
}

export function authToastMessage(reasons: IdentityFailureReason[]): string {
  const leetcodeMissing = reasons.includes("leetcode_signed_out");
  const extensionMissing = reasons.includes("extension_signed_out");

  if (leetcodeMissing && extensionMissing) {
    return "Sign in to LeetCode and the extension to keep tracking.";
  }
  if (leetcodeMissing) {
    return "Sign in to LeetCode to resume automated ledger tracking.";
  }
  if (extensionMissing) {
    return "Open the LeetLedger extension popup to sign in before tracking can resume.";
  }
  return "Sign in to resume automated ledger tracking.";
}

export const ACCOUNT_CHANGED_KEY = "account_changed";

export const ACCOUNT_CHANGED_MESSAGE =
  "Your LeetCode or LeetLedger account changed. Reload the page to resume tracking.";

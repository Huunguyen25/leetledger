/** Canonical identity states persisted by the background store. */
export type IdentityState = "inactive" | "active" | "account_changed";

/** Fully resolved credentials when both LeetCode and extension auth are present. */
export interface ResolvedIdentity {
  leetcodeUsername: string;
  supabaseUid: string;
}

/** Snapshot written to browser.storage.local under ll_active_identity. */
export interface IdentitySnapshot {
  state: IdentityState;
  leetcodeUsername: string | null;
  supabaseUid: string | null;
  updatedAt: number;
}

/** Why identity resolution failed (when not fully active). */
export type IdentityFailureReason =
  | "leetcode_signed_out"
  | "extension_signed_out"
  | "network_error";

export interface IdentityResolveSuccess {
  ok: true;
  identity: ResolvedIdentity;
}

export interface IdentityResolveFailure {
  ok: false;
  reasons: IdentityFailureReason[];
  leetcodeUsername: string | null;
  supabaseUid: string | null;
}

export type IdentityResolveResult =
  | IdentityResolveSuccess
  | IdentityResolveFailure;

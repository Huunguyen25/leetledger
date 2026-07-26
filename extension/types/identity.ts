/** Canonical identity states persisted by the background store. */
export type IdentityState = "inactive" | "active" | "account_changed";

/** Snapshot written to browser.storage.local under ll_active_identity. */
export interface IdentitySnapshot {
  state: IdentityState;
  leetcodeUsername: string | null;
  supabaseUid: string | null;
  updatedAt: number;
}

/** Why identity resolution failed when both accounts are not available. */
export type IdentityFailureReason =
  | "leetcode_signed_out"
  | "extension_signed_out"
  | "network_error";

/** Content-script report sent to the background identity store. */
export interface IdentityReportMessage {
  type: "IDENTITY_REPORT";
  leetcodeUsername: string | null;
  supabaseUid: string | null;
  reasons: IdentityFailureReason[];
}

/** Background response to an identity report. */
export interface IdentityReportResponse {
  state: IdentityState;
}

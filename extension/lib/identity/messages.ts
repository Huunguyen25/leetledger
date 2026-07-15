import type { IdentityFailureReason } from "./types";

export interface IdentityReportMessage {
  type: "IDENTITY_REPORT";
  leetcodeUsername: string | null;
  supabaseUid: string | null;
  reasons: IdentityFailureReason[];
}

export interface IdentityReportResponse {
  state: "inactive" | "active" | "account_changed";
}

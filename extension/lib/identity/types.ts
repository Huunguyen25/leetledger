import type { IdentityFailureReason } from "@/types/identity";

/** Fully resolved credentials when both LeetCode and extension auth are present. */
export interface ResolvedIdentity {
  leetcodeUsername: string;
  supabaseUid: string;
}

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

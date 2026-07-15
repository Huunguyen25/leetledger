import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchLeetCodeUsername } from "./leetcode-user";
import type {
  IdentityFailureReason,
  IdentityResolveResult,
} from "./types";

export async function resolveIdentity(): Promise<IdentityResolveResult> {
  const supabase = getSupabaseClient();

  const [leetcodeResult, sessionResult] = await Promise.all([
    fetchLeetCodeUsername(),
    supabase.auth.getSession(),
  ]);

  const supabaseUid = sessionResult.data.session?.user.id ?? null;
  const reasons: IdentityFailureReason[] = [];

  let leetcodeUsername: string | null = null;

  if (leetcodeResult.ok) {
    leetcodeUsername = leetcodeResult.username;
  } else if (leetcodeResult.reason === "signed_out") {
    reasons.push("leetcode_signed_out");
  } else {
    reasons.push("network_error");
  }

  if (!supabaseUid) {
    reasons.push("extension_signed_out");
  }

  if (leetcodeUsername && supabaseUid) {
    return {
      ok: true,
      identity: { leetcodeUsername, supabaseUid },
    };
  }

  return {
    ok: false,
    reasons,
    leetcodeUsername,
    supabaseUid,
  };
}

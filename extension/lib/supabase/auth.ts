import type { AuthError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

type AuthResult =
  | { success: true }
  | { success: false; error: AuthError | null };

export const supabaseAuth = getSupabaseClient().auth;

/** Sends the six-digit email code used by the popup sign-in flow. */
export async function signInWithEmail(email: string): Promise<AuthResult> {
  const { error } = await supabaseAuth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error("Send OTP error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

/** Verifies an email OTP for both new and returning users. */
export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<AuthResult> {
  const { error } = await supabaseAuth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    console.error("Verify OTP error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabaseAuth.signOut();
  if (error) {
    console.error("Sign out error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

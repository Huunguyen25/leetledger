import type { AuthError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

type AuthResult =
  | { success: true }
  | { success: false; error: AuthError | null };

export type OtpVerifyType = "email" | "signup";

export const supabaseAuth = getSupabaseClient().auth;

/** Validates credentials, then sends an OTP for sign-in verification. */
export async function requestSignInOtp(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error: passwordError } = await supabaseAuth.signInWithPassword({
    email,
    password,
  });
  if (passwordError) {
    console.error("Password sign-in error");
    return { success: false, error: passwordError };
  }
  // Do not keep the intermediate password-only session.
  const { error: signOutError } = await supabaseAuth.signOut();
  if (signOutError) {
    console.error("Intermediate sign-out error:", signOutError.message);
    return { success: false, error: signOutError };
  }
  const { error } = await supabaseAuth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    console.error("Send OTP error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

/** Creates an account, then sends an OTP challenge for confirmation. */
export async function requestSignUpOtp(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabaseAuth.signUp({ email, password });
  if (error) {
    console.error("Sign up error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

/** Verifies an email OTP for sign-in or signup confirmation. */
export async function verifyEmailOtp(
  email: string,
  token: string,
  type: OtpVerifyType,
): Promise<AuthResult> {
  const { error } = await supabaseAuth.verifyOtp({
    email,
    token,
    type,
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

import { createClient } from "@/lib/supabase/client";
import type { AuthError } from "@supabase/supabase-js";

const supabase = createClient();

type AuthResult =
  | { success: true }
  | { success: false; error: AuthError | null };

/**
 * Sends a 6-digit OTP code to the user's email.
 * Note: requires the Supabase project's email template to include {{ .Token }}.
 * If the template still includes {{ .ConfirmationURL }}, the email will also
 * contain a magic link, but the code path here ignores it.
 */
async function signInWithEmail(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error("Send OTP error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

/**
 * Verifies the 6-digit OTP code emailed to the user. On success, the
 * Supabase client persists the session and onAuthStateChange fires
 * SIGNED_IN.
 */
async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    // "email" is the correct type for OTP login and also verifies the
    // auto-created user from signInWithOtp({ shouldCreateUser: true }).
    // "signup" only matches a brand-new unconfirmed user's token, so reusing
    // an existing email made the server reject the code as otp_expired.
    type: "email",
  });
  if (error) {
    console.error("Verify OTP error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out error:", error.message);
    return { success: false, error };
  }
  return { success: true };
}

const supabaseApi = {
  client: supabase,
  signInWithEmail,
  verifyEmailOtp,
  signOut,
};

export default supabaseApi;

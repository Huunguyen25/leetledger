import { browser } from "wxt/browser";
import constants from "@/constants";

/**
 * Persisted "awaiting OTP" state.
 *
 * After a code is emailed, the popup may be closed before the user verifies.
 * We persist the pending email (with an expiry) to browser.storage.local so the
 * popup can restore the 6-digit verify form on reopen instead of dropping back
 * to the email form and triggering another resend.
 *
 * The entry is self-healing: once it expires it is removed on the next read, so
 * a stale verify form is never shown and the key does not linger in storage.
 */

/**
 * How long the pending state stays valid. Matches Supabase's default email OTP
 * validity (3600s); after this the code is dead, so the verify form is useless.
 */
export const OTP_TTL_MS = 60 * 60 * 1000;

interface PendingOtp {
  email: string;
  expiresAt: number;
}

function isPendingOtp(value: unknown): value is PendingOtp {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === "string" && typeof v.expiresAt === "number";
}

/** Returns the pending email if one is set and not expired; else null. */
export async function getPendingOtp(): Promise<string | null> {
  const result = await browser.storage.local.get(constants.PENDING_OTP_KEY);
  const pending = result[constants.PENDING_OTP_KEY];
  if (!isPendingOtp(pending)) return null;
  if (pending.expiresAt <= Date.now()) {
    await clearPendingOtp();
    return null;
  }
  return pending.email;
}

/** Records that an OTP was sent to `email`, valid for OTP_TTL_MS. */
export async function setPendingOtp(email: string): Promise<void> {
  const pending: PendingOtp = {
    email,
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  await browser.storage.local.set({ [constants.PENDING_OTP_KEY]: pending });
}

/** Clears any persisted pending OTP state. */
export async function clearPendingOtp(): Promise<void> {
  await browser.storage.local.remove(constants.PENDING_OTP_KEY);
}

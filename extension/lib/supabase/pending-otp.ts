import { browser } from "wxt/browser";
import constants from "@/constants";

/** Supabase email codes are valid for one hour by default. */
export const OTP_TTL_MS = 60 * 60 * 1000;

/** Minimum wait before the popup offers another code. */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export interface PendingOtp {
  email: string;
  expiresAt: number;
  /** When the latest code was sent — drives the resend cooldown. */
  sentAt: number;
}

function isPendingOtp(value: unknown): value is PendingOtp {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.expiresAt === "number" &&
    (typeof candidate.sentAt === "number" || candidate.sentAt === undefined)
  );
}

function normalizePending(pending: PendingOtp): PendingOtp {
  // Older records only stored email + expiresAt; infer sentAt from the TTL window.
  if (typeof pending.sentAt !== "number") {
    return {
      ...pending,
      sentAt: pending.expiresAt - OTP_TTL_MS,
    };
  }
  return pending;
}

/** Restores an unexpired popup verification flow (email + send timestamp). */
export async function getPendingOtp(): Promise<PendingOtp | null> {
  const result = await browser.storage.local.get(constants.PENDING_OTP_KEY);
  const pending = result[constants.PENDING_OTP_KEY];
  if (!isPendingOtp(pending)) return null;
  if (pending.expiresAt <= Date.now()) {
    await clearPendingOtp();
    return null;
  }
  return normalizePending(pending);
}

export async function setPendingOtp(email: string): Promise<PendingOtp> {
  const now = Date.now();
  const pending: PendingOtp = {
    email,
    expiresAt: now + OTP_TTL_MS,
    sentAt: now,
  };
  await browser.storage.local.set({ [constants.PENDING_OTP_KEY]: pending });
  return pending;
}

export async function clearPendingOtp(): Promise<void> {
  await browser.storage.local.remove(constants.PENDING_OTP_KEY);
}

/** Seconds remaining before another code can be requested (0 = ready). */
export function resendCooldownSeconds(sentAt: number, now = Date.now()): number {
  const remainingMs = sentAt + OTP_RESEND_COOLDOWN_MS - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

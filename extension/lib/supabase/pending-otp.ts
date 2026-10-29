import { browser } from "wxt/browser";
import constants from "@/constants";

/** Supabase email codes are valid for one hour by default. */
export const OTP_TTL_MS = 60 * 60 * 1000;

export type PendingOtpFlow = "sign-in" | "sign-up";

export interface PendingOtp {
  email: string;
  expiresAt: number;
  flow: PendingOtpFlow;
}

function isPendingOtp(value: unknown): value is PendingOtp {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.expiresAt === "number"
  );
}

/** Restores an unexpired popup verification flow. */
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

/** Restores an unexpired popup verification flow and account intent. */
export async function getPendingOtpState(): Promise<PendingOtp | null> {
  const result = await browser.storage.local.get(constants.PENDING_OTP_KEY);
  const pending = result[constants.PENDING_OTP_KEY];
  if (!isPendingOtp(pending)) return null;
  if (pending.expiresAt <= Date.now()) {
    await clearPendingOtp();
    return null;
  }
  // Backward compatibility with pre-flow records.
  if (!pending.flow) {
    return { ...pending, flow: "sign-in" };
  }
  return pending;
}

export async function setPendingOtp(
  email: string,
  flow: PendingOtpFlow,
): Promise<void> {
  const pending: PendingOtp = {
    email,
    expiresAt: Date.now() + OTP_TTL_MS,
    flow,
  };
  await browser.storage.local.set({ [constants.PENDING_OTP_KEY]: pending });
}

export async function clearPendingOtp(): Promise<void> {
  await browser.storage.local.remove(constants.PENDING_OTP_KEY);
}

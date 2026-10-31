"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  OtpVerifyScreen,
  type OtpVerifyBusy,
} from "@/components/auth/otp-verify";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

// Loads shared email/OTP auth screen styles (also used by OtpVerifyScreen).
import "@/components/auth/otp-verify/otp-verify.css";

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function resendCooldownSeconds(sentAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((sentAt + OTP_RESEND_COOLDOWN_MS - now) / 1000));
}

export function SignInForm() {
  const router = useRouter();
  const {
    authConfigured,
    sessionEmail,
    dataStatus,
    sendOtp,
    verifyOtp,
  } = useDashboard();
  const [otpEmail, setOtpEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [authBusy, setAuthBusy] = useState<
    "send" | OtpVerifyBusy | null
  >(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signedOutNotice, setSignedOutNotice] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("leetledger-signed-out") !== "1") return;
      window.sessionStorage.removeItem("leetledger-signed-out");
      setSignedOutNotice(true);
    } catch {
      // Ignore storage access failures.
    }
  }, []);

  useEffect(() => {
    if (sessionEmail && dataStatus !== "checking" && dataStatus !== "signed-out") {
      router.replace("/");
    }
  }, [dataStatus, router, sessionEmail]);

  useEffect(() => {
    if (sentAt == null) {
      setCooldown(0);
      return;
    }
    const tick = () => setCooldown(resendCooldownSeconds(sentAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sentAt]);

  async function onSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy("send");
    setAuthMessage(null);
    setAuthError(null);
    setSignedOutNotice(false);
    try {
      await sendOtp(otpEmail.trim());
      setOtpSent(true);
      setSentAt(Date.now());
      setOtpToken("");
      setAuthMessage("Check your email for the six-digit code.");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setAuthBusy(null);
    }
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy("verify");
    setAuthError(null);
    try {
      await verifyOtp(otpEmail.trim(), otpToken.trim());
      setOtpToken("");
      setOtpSent(false);
      setSentAt(null);
      router.replace("/");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Invalid or expired code",
      );
    } finally {
      setAuthBusy(null);
    }
  }

  async function onResendCode() {
    if (authBusy || cooldown > 0 || !otpEmail.trim()) return;
    setAuthBusy("resend");
    setAuthError(null);
    try {
      await sendOtp(otpEmail.trim());
      setSentAt(Date.now());
      setOtpToken("");
      setAuthMessage("Check your email for the six-digit code.");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Failed to resend code",
      );
    } finally {
      setAuthBusy(null);
    }
  }

  function onDifferentEmail() {
    setOtpSent(false);
    setOtpToken("");
    setSentAt(null);
    setAuthMessage(null);
    setAuthError(null);
  }

  if (otpSent) {
    return (
      <OtpVerifyScreen
        email={otpEmail}
        code={otpToken}
        onCodeChange={setOtpToken}
        onVerify={onVerifyCode}
        onResend={() => void onResendCode()}
        onDifferentEmail={onDifferentEmail}
        busy={authBusy === "verify" || authBusy === "resend" ? authBusy : null}
        cooldown={cooldown}
        error={authError}
        hint={authMessage ?? "Check your email for the six-digit code."}
      />
    );
  }

  return (
    <div className="signin-page">
      <div className="signin-panel">
        <div className="signin-brand">
          <span className="brand-mark" aria-hidden="true">
            LL
          </span>
          <span className="brand-name">LeetLedger</span>
        </div>
        <h1>Sign in</h1>
        <p className="signin-lead">
          Use the same email as the extension to load your reviews.
        </p>

        {signedOutNotice && (
          <div className="notice signin-notice" role="status">
            You have successfully signed out.
          </div>
        )}

        {!authConfigured ? (
          <div className="notice data-notice" role="alert">
            <strong>Supabase is not configured.</strong> Add
            NEXT_PUBLIC_SUPABASE_URL and a publishable key to{" "}
            <code>.env.local</code>.
          </div>
        ) : dataStatus === "checking" && !signedOutNotice ? (
          <div className="notice signin-notice" role="status">
            Checking your session…
          </div>
        ) : (
          <form className="signin-form" onSubmit={onSendCode}>
            <label>
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={otpEmail}
                disabled={authBusy !== null}
                onChange={(event) => setOtpEmail(event.target.value)}
              />
            </label>
            {authError && (
              <p className="signin-error" role="alert">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="signin-submit"
              disabled={authBusy !== null}
            >
              {authBusy === "send" ? "Sending…" : "Send code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

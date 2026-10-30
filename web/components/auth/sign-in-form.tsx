"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

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
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);
    setSignedOutNotice(false);
    try {
      if (!otpSent) {
        await sendOtp(otpEmail.trim());
        setOtpSent(true);
        setAuthMessage("Check your email for the six-digit code.");
      } else {
        await verifyOtp(otpEmail.trim(), otpToken.trim());
        setOtpToken("");
        setOtpSent(false);
        router.replace("/");
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setAuthBusy(false);
    }
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
          <form className="signin-form" onSubmit={onSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={otpEmail}
                disabled={otpSent || authBusy}
                onChange={(event) => setOtpEmail(event.target.value)}
              />
            </label>
            {otpSent && (
              <label>
                <span>Six-digit code</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otpToken}
                  disabled={authBusy}
                  onChange={(event) => setOtpToken(event.target.value)}
                />
              </label>
            )}
            {authMessage && <p role="status">{authMessage}</p>}
            <button
              type="submit"
              className="button primary"
              disabled={authBusy}
            >
              {authBusy
                ? "Working…"
                : otpSent
                  ? "Verify code"
                  : "Send code"}
            </button>
            {otpSent && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpToken("");
                  setAuthMessage(null);
                }}
              >
                Use a different email
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

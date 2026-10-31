import type { FormEvent } from "react";
import "./otp-verify.css";

export type OtpVerifyBusy = "verify" | "resend" | null;

export interface OtpVerifyScreenProps {
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  onVerify: (event: FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onDifferentEmail: () => void;
  busy: OtpVerifyBusy;
  cooldown: number;
  error?: string | null;
  hint?: string;
}

/**
 * Dashboard OTP verification screen.
 * Keep this presentational — auth/session logic lives in the host form.
 * Markup/classes match the email sign-in screen 1:1.
 */
export function OtpVerifyScreen({
  email,
  code,
  onCodeChange,
  onVerify,
  onResend,
  onDifferentEmail,
  busy,
  cooldown,
  error = null,
  hint = "Check your email for the six-digit code.",
}: OtpVerifyScreenProps) {
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
        <form className="signin-form" onSubmit={onVerify}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              disabled
              readOnly
              autoComplete="email"
              aria-label="Email"
            />
          </label>
          <label>
            <span>Six-digit code</span>
            <input
              className="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="0 0 0 0 0 0"
              maxLength={6}
              value={code}
              disabled={busy !== null}
              onChange={(event) =>
                onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
              required
              aria-label="Six-digit code"
            />
          </label>
          <p className="signin-hint">{hint}</p>
          {error ? (
            <p className="signin-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="signin-submit"
            disabled={busy !== null || code.length < 6}
          >
            {busy === "verify" ? "Verifying…" : "Verify code"}
          </button>
        </form>
        <div className="signin-secondary">
          <button
            type="button"
            className="signin-link"
            onClick={onResend}
            disabled={busy !== null || cooldown > 0}
          >
            {busy === "resend"
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Send another code"}
          </button>
          <button
            type="button"
            className="signin-link"
            onClick={onDifferentEmail}
            disabled={busy !== null}
          >
            Different email
          </button>
        </div>
      </div>
    </div>
  );
}

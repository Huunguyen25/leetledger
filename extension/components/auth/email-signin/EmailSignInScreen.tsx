import type { FormEvent } from "react";
import "../otp-verify/otp-verify.css";

export interface EmailSignInScreenProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error?: string | null;
}

/**
 * Extension email sign-in screen.
 * Independent copy of the dashboard email input screen (same markup/classes).
 */
export function EmailSignInScreen({
  email,
  onEmailChange,
  onSubmit,
  busy,
  error = null,
}: EmailSignInScreenProps) {
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
        <form className="signin-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={busy}
              autoFocus
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </label>
          {error ? (
            <p className="signin-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="signin-submit"
            disabled={busy || !email}
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      </div>
    </div>
  );
}

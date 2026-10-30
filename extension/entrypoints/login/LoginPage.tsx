import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { maskEmail } from "@/lib/identity/mask-email";
import {
  signInWithEmail,
  supabaseAuth,
  verifyEmailOtp,
} from "@/lib/supabase/auth";
import {
  clearPendingOtp,
  getPendingOtp,
  resendCooldownSeconds,
  setPendingOtp,
} from "@/lib/supabase/pending-otp";

type AuthBusy = "send" | "verify" | "resend" | null;
type Step = "loading" | "email" | "code" | "done";

const CLOSE_AFTER_MS = 1400;

function AuthCard({
  title,
  subtitle,
  children,
  centered = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className="login-shell">
      <div className={`auth${centered ? " auth-centered" : ""}`}>
        <header className="auth-header">
          <p className="auth-brand">LeetLedger</p>
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<AuthBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("loading");

  useEffect(() => {
    Promise.all([supabaseAuth.getSession(), getPendingOtp()])
      .then(([{ data }, pending]) => {
        if (data.session) {
          void clearPendingOtp();
          setStep("done");
          return;
        }
        if (pending) {
          setPendingEmail(pending.email);
          setEmail(pending.email);
          setSentAt(pending.sentAt);
          setStep("code");
          return;
        }
        setStep("email");
      })
      .catch(() => setStep("email"));

    const { data: sub } = supabaseAuth.onAuthStateChange((_event, session) => {
      if (!session) return;
      void clearPendingOtp();
      setPendingEmail(null);
      setSentAt(null);
      setCode("");
      setError(null);
      setStep("done");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (step !== "done") return;
    const id = window.setTimeout(() => window.close(), CLOSE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [step]);

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

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy("send");
    setError(null);
    const result = await signInWithEmail(email);
    setBusy(null);
    if (!result.success) {
      setError(result.error?.message ?? "Failed to send code");
      return;
    }
    const pending = await setPendingOtp(email);
    setPendingEmail(pending.email);
    setSentAt(pending.sentAt);
    setCode("");
    setStep("code");
  }

  async function handleResendCode() {
    if (!pendingEmail || busy || cooldown > 0) return;
    setBusy("resend");
    setError(null);
    const result = await signInWithEmail(pendingEmail);
    setBusy(null);
    if (!result.success) {
      setError(result.error?.message ?? "Failed to resend code");
      return;
    }
    const pending = await setPendingOtp(pendingEmail);
    setSentAt(pending.sentAt);
    setCode("");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (!pendingEmail || !code || busy) return;
    setBusy("verify");
    setError(null);
    const result = await verifyEmailOtp(pendingEmail, code);
    setBusy(null);
    if (!result.success) {
      setError(result.error?.message ?? "Invalid or expired code");
    }
  }

  function handleDifferentEmail() {
    void clearPendingOtp();
    setPendingEmail(null);
    setSentAt(null);
    setCode("");
    setError(null);
    setStep("email");
  }

  if (step === "loading") {
    return <AuthCard title="Loading…" centered />;
  }

  if (step === "done") {
    return (
      <AuthCard
        title="You're signed in"
        subtitle="This tab will close. Open the extension popup to continue."
        centered
      />
    );
  }

  if (step === "code" && pendingEmail) {
    const masked = maskEmail(pendingEmail);
    return (
      <AuthCard
        title="Enter your code"
        subtitle={
          <>
            Sent to <span className="auth-email">{masked}</span>
          </>
        }
      >
        <form className="auth-form" onSubmit={handleVerifyCode}>
          <input
            className="auth-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={8}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            disabled={busy !== null}
            autoFocus
            aria-label="Verification code"
          />
          <button
            type="submit"
            className="auth-submit"
            disabled={busy !== null || code.length < 6}
          >
            {busy === "verify" ? "Verifying…" : "Verify"}
          </button>
        </form>
        <div className="auth-secondary">
          <button
            type="button"
            className="auth-link"
            onClick={() => void handleResendCode()}
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
            className="auth-link"
            onClick={handleDifferentEmail}
            disabled={busy !== null}
          >
            Different email
          </button>
        </div>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Sign in" subtitle="Sync reviews across devices.">
      <form className="auth-form" onSubmit={handleSendCode}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy !== null}
          autoFocus
          required
          aria-label="Email"
        />
        <button
          type="submit"
          className="auth-submit"
          disabled={busy !== null || !email}
        >
          {busy === "send" ? "Sending…" : "Send code"}
        </button>
      </form>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </AuthCard>
  );
}

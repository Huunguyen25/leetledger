import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EmailSignInScreen } from "@/components/auth/email-signin";
import {
  OtpVerifyScreen,
  type OtpVerifyBusy,
} from "@/components/auth/otp-verify";
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

type AuthBusy = "send" | OtpVerifyBusy;
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
  const [busy, setBusy] = useState<AuthBusy | null>(null);
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
    return (
      <OtpVerifyScreen
        email={pendingEmail}
        code={code}
        onCodeChange={setCode}
        onVerify={handleVerifyCode}
        onResend={() => void handleResendCode()}
        onDifferentEmail={handleDifferentEmail}
        busy={busy === "verify" || busy === "resend" ? busy : null}
        cooldown={cooldown}
        error={error}
      />
    );
  }

  return (
    <EmailSignInScreen
      email={email}
      onEmailChange={setEmail}
      onSubmit={handleSendCode}
      busy={busy === "send"}
      error={error}
    />
  );
}

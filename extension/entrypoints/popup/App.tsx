import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "@/components/popup/Dashboard";
import { clearHistoryCache } from "@/lib/review/cache";
import {
  requestSignInOtp,
  requestSignUpOtp,
  signOut,
  supabaseAuth,
  verifyEmailOtp,
} from "@/lib/supabase/auth";
import {
  clearPendingOtp,
  getPendingOtpState,
  type PendingOtpFlow,
  setPendingOtp,
} from "@/lib/supabase/pending-otp";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [authFlow, setAuthFlow] = useState<PendingOtpFlow>("sign-in");
  const [pendingOtp, setPendingOtpState] = useState<{
    email: string;
    flow: PendingOtpFlow;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gates the first render until session + persisted OTP state are read, so the
  // email form doesn't flash before we know there's a pending verification.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    Promise.all([
      supabaseAuth.getSession(),
      getPendingOtpState(),
    ])
      .then(([{ data }, pending]) => {
        setSession(data.session);
        // Only restore the verify form when not already signed in.
        if (!data.session && pending) setPendingOtpState(pending);
      })
      .finally(() => setInitializing(false));

    const { data: sub } = supabaseAuth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) {
          void clearPendingOtp();
          setPendingOtpState(null);
          setEmail("");
          setPassword("");
          setCode("");
          setError(null);
        } else {
          void clearHistoryCache();
          void clearPendingOtp();
        }
      },
    );

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);
    const result =
      authFlow === "sign-in"
        ? await requestSignInOtp(email, password)
        : await requestSignUpOtp(email, password);
    setLoading(false);
    if (result.success) {
      await setPendingOtp(email, authFlow);
      setPendingOtpState({ email, flow: authFlow });
      setCode("");
    } else {
      setError(result.error?.message ?? "Failed to send code");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingOtp || !code || loading) return;
    setLoading(true);
    setError(null);
    const result = await verifyEmailOtp(
      pendingOtp.email,
      code,
      pendingOtp.flow === "sign-up" ? "signup" : "email",
    );
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? "Invalid or expired code");
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    await clearHistoryCache();
    setLoading(false);
  }

  if (initializing) {
    return (
      <div className="auth">
        <h1 className="auth-title">LeetLedger</h1>
        <p className="auth-subtitle">Loading…</p>
      </div>
    );
  }

  if (session) {
    return (
      <Dashboard
        session={session}
        onSignOut={handleSignOut}
        signingOut={loading}
      />
    );
  }

  if (pendingOtp) {
    return (
      <div className="auth">
        <h1 className="auth-title">LeetLedger</h1>
        <p>
          We sent a code to {pendingOtp.email}. Enter it to{" "}
          {pendingOtp.flow === "sign-up" ? "finish creating your account" : "sign in"}.
        </p>
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading || code.length === 0}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            void clearPendingOtp();
            setPendingOtpState(null);
            setCode("");
            setError(null);
          }}
          disabled={loading}
        >
          Use a different email
        </button>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </div>
    );
  }

  return (
    <div className="auth">
      <h1 className="auth-title">LeetLedger</h1>
      <p className="auth-subtitle">
        {authFlow === "sign-in"
          ? "Sign in with your account password, then verify with OTP."
          : "Create an account with a password, then verify with OTP."}
      </p>
      <form onSubmit={handleSendCode}>
        <select
          value={authFlow}
          onChange={(e) => setAuthFlow(e.target.value as PendingOtpFlow)}
          disabled={loading}
        >
          <option value="sign-in">Sign in</option>
          <option value="sign-up">Create account</option>
        </select>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoFocus
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete={
            authFlow === "sign-up" ? "new-password" : "current-password"
          }
          required
        />
        <button type="submit" disabled={loading || !email || !password}>
          {loading
            ? "Sending…"
            : authFlow === "sign-up"
              ? "Create + send code"
              : "Sign in + send code"}
        </button>
      </form>
      {error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  );
}

export default App;

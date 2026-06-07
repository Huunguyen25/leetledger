import "./App.css";
import supabaseApi from "@/lib/supabase/supabase-object";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./components/Dashboard";
import { clearHistoryCache } from "@/lib/history-cache";
import {
  clearPendingOtp,
  getPendingOtp,
  setPendingOtp,
} from "@/lib/pending-otp";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gates the first render until session + persisted OTP state are read, so the
  // email form doesn't flash before we know there's a pending verification.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    Promise.all([
      supabaseApi.client.auth.getSession(),
      getPendingOtp(),
    ])
      .then(([{ data }, pending]) => {
        setSession(data.session);
        // Only restore the verify form when not already signed in.
        if (!data.session && pending) setPendingEmail(pending);
      })
      .finally(() => setInitializing(false));

    const { data: sub } = supabaseApi.client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) {
          void clearPendingOtp();
          setPendingEmail(null);
          setEmail("");
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
    if (!email || loading) return;
    setLoading(true);
    setError(null);
    const result = await supabaseApi.signInWithEmail(email);
    setLoading(false);
    if (result.success) {
      await setPendingOtp(email);
      setPendingEmail(email);
      setCode("");
    } else {
      setError(result.error?.message ?? "Failed to send code");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEmail || !code || loading) return;
    setLoading(true);
    setError(null);
    const result = await supabaseApi.verifyEmailOtp(pendingEmail, code);
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? "Invalid or expired code");
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabaseApi.signOut();
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

  if (pendingEmail) {
    return (
      <div className="auth">
        <h1 className="auth-title">LeetLedger</h1>
        <p>We sent a code to {pendingEmail}</p>
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
            setPendingEmail(null);
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
      <p className="auth-subtitle">Sign in to sync your reviews.</p>
      <form onSubmit={handleSendCode}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoFocus
          required
        />
        <button type="submit" disabled={loading || !email}>
          {loading ? "Sending…" : "Send code"}
        </button>
      </form>
      {error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  );
}

export default App;

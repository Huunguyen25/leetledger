import "./App.css";
import supabaseApi from "@/lib/supabase/supabase-object";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseApi.client.auth
      .getSession()
      .then(({ data }) => setSession(data.session));

    const { data: sub } = supabaseApi.client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) {
          setPendingEmail(null);
          setEmail("");
          setCode("");
          setError(null);
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
    setLoading(false);
  }

  if (session) {
    return (
      <>
        <div>leetledger extension</div>
        <div>Signed in as {session.user.email ?? session.user.id}</div>
        <button onClick={handleSignOut} disabled={loading}>
          Sign out
        </button>
      </>
    );
  }

  if (pendingEmail) {
    return (
      <>
        <div>leetledger extension</div>
        <p>We sent a code to {pendingEmail}</p>
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="8-digit code"
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
            setPendingEmail(null);
            setCode("");
            setError(null);
          }}
          disabled={loading}
        >
          Use a different email
        </button>
        {error && <div role="alert">{error}</div>}
      </>
    );
  }

  return (
    <>
      <div>leetledger extension</div>
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
      {error && <div role="alert">{error}</div>}
    </>
  );
}

export default App;

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "@/components/popup/Dashboard";
import { clearHistoryCache } from "@/lib/review/cache";
import { signOut, supabaseAuth } from "@/lib/supabase/auth";
import { startLogin } from "@/lib/supabase/start-login";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabaseAuth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setInitializing(false));

    const { data: sub } = supabaseAuth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        if (event === "SIGNED_OUT") {
          void clearHistoryCache();
        }
      },
    );

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignIn() {
    if (openingLogin) return;
    setOpeningLogin(true);
    try {
      await startLogin();
      // Popup usually closes when the new tab focuses; ignore if it stays open.
    } finally {
      setOpeningLogin(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    await clearHistoryCache();
    setSigningOut(false);
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
        signingOut={signingOut}
      />
    );
  }

  return (
    <div className="auth">
      <h1 className="auth-title">LeetLedger</h1>
      <p className="auth-subtitle">Sign in to sync your reviews.</p>
      <button
        type="button"
        className="auth-submit"
        onClick={() => void handleSignIn()}
        disabled={openingLogin}
      >
        {openingLogin ? "Opening…" : "Sign in"}
      </button>
    </div>
  );
}

export default App;

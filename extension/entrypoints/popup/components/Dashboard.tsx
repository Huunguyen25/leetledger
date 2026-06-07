import type { Session } from "@supabase/supabase-js";
import constants from "@/constants";
import MuteControl from "./MuteControl";
import SolvedHistory from "./SolvedHistory";

interface DashboardProps {
  session: Session;
  onSignOut: () => void;
  signingOut: boolean;
}

/** Signed-in popup view: account, dashboard link, mute controls, history. */
export default function Dashboard({
  session,
  onSignOut,
  signingOut,
}: DashboardProps) {
  const openDashboard = () => {
    window.open(constants.DASHBOARD_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand-name">LeetLedger</span>
          <span className="brand-email">
            {session.user.email ?? session.user.id}
          </span>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="action-btn" onClick={openDashboard}>
            Dashboard
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <MuteControl />
      <SolvedHistory userId={session.user.id} />
    </div>
  );
}

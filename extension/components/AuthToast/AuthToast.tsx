import { useEffect } from "react";
import { IoIosAlert, IoMdClose } from "react-icons/io";
import "./style.css";

interface AuthToastProps {
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. Pass 0 or a negative value to disable. */
  durationMs?: number;
}

export default function AuthToast({
  message,
  onDismiss,
  durationMs = 15000,
}: AuthToastProps) {
  useEffect(() => {
    if (!durationMs || durationMs <= 0) return;
    const timeoutId = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timeoutId);
  }, [durationMs, onDismiss]);

  const hasTimer = Boolean(durationMs && durationMs > 0);

  return (
    <div className="auth-toast" role="status" aria-live="polite">
      <div className="auth-toast-row">
        <div className="auth-toast-accent" aria-hidden="true" />
        <IoIosAlert className="auth-toast-icon" aria-hidden="true" />
        <div className="auth-toast-content">
          <p className="auth-toast-title">Sign in required</p>
          <p className="auth-toast-message">{message}</p>
        </div>
        <button
          type="button"
          className="auth-toast-close"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <IoMdClose />
        </button>
      </div>
      {hasTimer && (
        <div className="auth-toast-timer" aria-hidden="true">
          <div
            className="auth-toast-timer-bar"
            style={{ animationDuration: `${durationMs}ms` }}
          />
        </div>
      )}
    </div>
  );
}

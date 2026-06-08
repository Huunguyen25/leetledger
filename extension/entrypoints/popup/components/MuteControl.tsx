import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import constants from "@/constants";
import { MUTE_DURATIONS, clearMute, getMuteUntil, muteFor } from "@/lib/mute";

function formatUntil(until: number): string {
  return new Date(until).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUntilFull(until: number): string {
  return new Date(until).toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact mute control: dropdown to silence review reminders, or unmute.
 */
export default function MuteControl() {
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const apply = (value: unknown) => {
      const next =
        typeof value === "number" && value > Date.now() ? value : null;
      if (active) setMutedUntil(next);
    };

    getMuteUntil().then(apply);

    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      if (constants.MUTE_KEY in changes) {
        apply(changes[constants.MUTE_KEY].newValue);
      }
    };
    browser.storage.local.onChanged.addListener(onChanged);

    return () => {
      active = false;
      browser.storage.local.onChanged.removeListener(onChanged);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isMuted = mutedUntil !== null;

  const handlePickDuration = (ms: number) => {
    setMenuOpen(false);
    void muteFor(ms);
  };

  return (
    <div className="mute-row">
      <span className="mute-label">Reminders</span>
      <div
        className={`mute-field${menuOpen ? " mute-field-open" : ""}`}
        ref={fieldRef}
      >
        {isMuted ? (
          <>
            <span
              className="mute-field-text"
              title={`Muted until ${formatUntilFull(mutedUntil)}`}
            >
              Until {formatUntil(mutedUntil)}
            </span>
            <button
              type="button"
              className="mute-unmute"
              onClick={() => clearMute()}
            >
              Unmute
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mute-field-trigger"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label="Mute review reminders"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Off
            </button>
            <span className="mute-field-chevron" aria-hidden="true" />
          </>
        )}
        {!isMuted && menuOpen && (
          <ul
            className="mute-field-menu"
            role="listbox"
            aria-label="Mute duration"
          >
            {MUTE_DURATIONS.map((duration) => (
              <li key={duration.label}>
                <button
                  type="button"
                  role="option"
                  className="mute-field-option"
                  onClick={() => handlePickDuration(duration.ms)}
                >
                  {duration.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

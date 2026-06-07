import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import constants from "@/constants";
import { MUTE_DURATIONS, clearMute, getMuteUntil, muteFor } from "@/lib/mute";

function formatUntil(until: number): string {
  return new Date(until).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact mute control: dropdown to silence review reminders, or unmute.
 */
export default function MuteControl() {
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [selectValue, setSelectValue] = useState("");

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

  const isMuted = mutedUntil !== null;

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectValue(value);
    if (!value) return;
    void muteFor(Number(value)).then(() => setSelectValue(""));
  };

  return (
    <div className="mute-row">
      <span className="mute-label">Reminders</span>
      {isMuted ? (
        <>
          <span className="mute-status-text">
            Muted until {formatUntil(mutedUntil)}
          </span>
          <button type="button" className="mute-unmute" onClick={() => clearMute()}>
            Unmute
          </button>
        </>
      ) : (
        <select
          className="mute-select"
          value={selectValue}
          onChange={handleSelectChange}
          aria-label="Mute review reminders"
        >
          <option value="">Off</option>
          {MUTE_DURATIONS.map((duration) => (
            <option key={duration.label} value={duration.ms}>
              {duration.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

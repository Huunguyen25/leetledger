import { useRef, useCallback, useEffect } from "react";
import "../components/ReviewDrawer/style.css";

const DifficultySlider = ({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const marks = Array.from(
    { length: (max - min) / step + 1 },
    (_, i) => min + i * step,
  );

  const pct = (value - min) / (max - min);

  const valueFromClient = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return value;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step, value],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onChange(valueFromClient(e.clientX));
    },
    [onChange, valueFromClient],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      onChange(valueFromClient(e.clientX));
    },
    [onChange, valueFromClient],
  );

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Math.min(max, value + step));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Math.max(min, value - step));
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(min);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(max);
      }
    },
    [onChange, value, min, max, step],
  );

  return (
    <div className="marked-slider">
      <div className="slider-wrapper">
        {/* Tooltip — same left as thumb */}
        <div className="slider-tooltip" style={{ left: `${pct * 100}%` }}>
          {value}
        </div>

        {/* Custom track */}
        <div
          ref={trackRef}
          className="slider-track"
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={handleKeyDown}
        >
          <div className="slider-fill" style={{ width: `${pct * 100}%` }} />
          {/* Thumb — left: pct%, translateX(-50%) */}
          <div className="slider-thumb" style={{ left: `${pct * 100}%` }} />
        </div>

        {/* Marks — each absolutely positioned at its own pct */}
        <div className="marks">
          {marks.map((m) => {
            const mPct = ((m - min) / (max - min)) * 100;
            return (
              <div
                key={m}
                className="mark"
                style={{ left: `${mPct}%` }}
              >
                <div className="mark-dot" />
                <span className={`mark-label${m === value ? " active" : ""}`}>
                  {m}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DifficultySlider;
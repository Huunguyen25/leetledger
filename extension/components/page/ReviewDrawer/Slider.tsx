import { useCallback, useRef } from "react";
import "./Slider.css";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Visual track / mark upper bound (always 10 for mastery). */
  max?: number;
  /**
   * Hard stop for the thumb. Defaults to `max`. Keep `max` at 10 and set this
   * to the assistance SRS cap so marks stay full-width while drag is limited.
   */
  valueMax?: number;
  step?: number;
}

export default function Slider({
  value,
  onChange,
  min = 1,
  max = 10,
  valueMax = max,
  step = 1,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbMax = Math.max(min, Math.min(max, valueMax));
  const marks = Array.from(
    { length: (max - min) / step + 1 },
    (_, index) => min + index * step,
  );
  const clampedValue = Math.max(min, Math.min(thumbMax, value));
  const percentage = (clampedValue - min) / (max - min);
  const capPercentage = (thumbMax - min) / (max - min);

  const valueFromClient = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return clampedValue;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(thumbMax, stepped));
    },
    [clampedValue, max, min, step, thumbMax],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      onChange(valueFromClient(event.clientX));
    },
    [onChange, valueFromClient],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.buttons !== 1) return;
      onChange(valueFromClient(event.clientX));
    },
    [onChange, valueFromClient],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        onChange(Math.min(thumbMax, clampedValue + step));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        onChange(Math.max(min, clampedValue - step));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(min);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(thumbMax);
      }
    },
    [clampedValue, min, onChange, step, thumbMax],
  );

  return (
    <div className="marked-slider">
      <div className="slider-wrapper">
        <div
          className="slider-tooltip"
          style={{ left: `${percentage * 100}%` }}
        >
          {clampedValue}
        </div>

        <div
          ref={trackRef}
          className="slider-track"
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={thumbMax}
          aria-valuenow={clampedValue}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={handleKeyDown}
        >
          {thumbMax < max && (
            <div
              className="slider-cap-region"
              style={{
                left: `${capPercentage * 100}%`,
                width: `${(1 - capPercentage) * 100}%`,
              }}
            />
          )}
          <div
            className="slider-fill"
            style={{ width: `${percentage * 100}%` }}
          />
          <div
            className="slider-thumb"
            style={{ left: `${percentage * 100}%` }}
          />
        </div>

        <div className="marks">
          {marks.map((mark) => {
            const markPercentage = ((mark - min) / (max - min)) * 100;
            const aboveCap = mark > thumbMax;
            return (
              <div
                key={mark}
                className={`mark${aboveCap ? " capped" : ""}`}
                style={{ left: `${markPercentage}%` }}
              >
                <div className="mark-dot" />
                <span
                  className={`mark-label${mark === clampedValue ? " active" : ""}${aboveCap ? " capped" : ""}`}
                >
                  {mark}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

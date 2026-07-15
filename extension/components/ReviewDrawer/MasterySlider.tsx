import { useCallback, useRef } from "react";

interface MasterySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function MasterySlider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
}: MasterySliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const marks = Array.from(
    { length: (max - min) / step + 1 },
    (_, index) => min + index * step,
  );
  const percentage = (value - min) / (max - min);

  const valueFromClient = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return value;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(max, stepped));
    },
    [max, min, step, value],
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
        onChange(Math.min(max, value + step));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        onChange(Math.max(min, value - step));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(min);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(max);
      }
    },
    [max, min, onChange, step, value],
  );

  return (
    <div className="marked-slider">
      <div className="slider-wrapper">
        <div
          className="slider-tooltip"
          style={{ left: `${percentage * 100}%` }}
        >
          {value}
        </div>

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
            return (
              <div
                key={mark}
                className="mark"
                style={{ left: `${markPercentage}%` }}
              >
                <div className="mark-dot" />
                <span
                  className={`mark-label${mark === value ? " active" : ""}`}
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

import "../assets/style.css";

const THUMB_SIZE = 18; // px — match the CSS thumb diameter

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
  const marks = Array.from(
    { length: (max - min) / step + 1 },
    (_, i) => min + i * step,
  );

  const pct = (value - min) / (max - min);
  // Compensate for the thumb being inset at the track edges
  const tooltipLeft = `calc(${pct * 100}% + ${(0.5 - pct) * THUMB_SIZE}px)`;

  return (
    <div className="marked-slider">
      <div className="slider-wrapper">
        <div className="slider-tooltip" style={{ left: tooltipLeft }}>
          {value}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="marks">
          {marks.map((m) => (
            <div key={m} className="mark">
              <div className="mark-dot" />
              <span className={`mark-label${m === value ? " active" : ""}`}>
                {m}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DifficultySlider;
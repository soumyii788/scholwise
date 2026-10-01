export default function ProgressBar({ value = 0, showLabel = true, size = "md" }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress-block progress-${size}`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && <span className="progress-label">{clamped}%</span>}
    </div>
  );
}

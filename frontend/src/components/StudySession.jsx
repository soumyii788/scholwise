import { minutesToClock, formatDuration } from "../utils/helpers.js";

export default function StudySession({ session, onToggle }) {
  if (session.is_break || session.session_type === "break") {
    return (
      <div className="session-row break-row">
        <span className="session-time">
          {minutesToClock(toMinutes(session.start_time))} – {minutesToClock(toMinutes(session.end_time))}
        </span>
        <span className="session-main">
          ☕ Break <small>({formatDuration(session.duration)})</small>
        </span>
      </div>
    );
  }

  const isRevision = session.session_type === "revision" || session.topic_id === null;

  return (
    <div className={`session-row ${session.status === "completed" ? "completed" : ""}`}>
      <span className="session-time">
        {minutesToClock(toMinutes(session.start_time))} – {minutesToClock(toMinutes(session.end_time))}
      </span>

      <span className="session-main">
        <strong>{session.subject_name || "Study"}</strong>
        <span className="session-topic">
          {isRevision ? `Revision: ${session.label || session.subject_name}` : session.topic_name}
        </span>
      </span>

      <span className="session-meta">
        <span className="duration-pill">{formatDuration(session.duration)}</span>
        {isRevision ? (
          <span className="revision-pill">Revision</span>
        ) : (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={session.status === "completed"}
              onChange={() => onToggle?.(session)}
            />
            Done
          </label>
        )}
      </span>
    </div>
  );
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
}

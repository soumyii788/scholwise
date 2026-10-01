import { formatDuration } from "../utils/helpers.js";

export default function TopicCard({ topic, onToggleComplete }) {
  const statusClass =
    topic.status === "completed" ? "done" : topic.status === "in_progress" ? "wip" : "";
  return (
    <div className={`topic-item ${statusClass}`}>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={topic.status === "completed"}
          onChange={() => onToggleComplete?.(topic, topic.status !== "completed")}
        />
      </label>
      <span className="topic-name">{topic.name}</span>
      <span className="badge badge-neutral">{topic.difficulty}</span>
      <span className="topic-minutes">{formatDuration(topic.estimated_minutes)}</span>
    </div>
  );
}

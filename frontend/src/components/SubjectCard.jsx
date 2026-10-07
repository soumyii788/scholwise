import { useState } from "react";
import ProgressBar from "./ProgressBar.jsx";
import { daysLeftLabel, urgencyBadgeClass, formatDuration } from "../utils/helpers.js";

// Rotating subject markers for visual variety
const MARKERS = ["●", "◆", "■", "◇", "▲", "○"];

export default function SubjectCard({
  subject,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onToggleComplete,
  onEdit,
  onDelete,
  index = 0,
}) {
  const [expanded, setExpanded] = useState(false);
  const [topicForm, setTopicForm] = useState({ name: "", estimated_minutes: 45, difficulty: "Medium" });
  const [topicError, setTopicError] = useState("");

  const completed = (subject.topics || []).filter((t) => t.status === "completed").length;
  const total = (subject.topics || []).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const marker = MARKERS[index % MARKERS.length];

  async function handleAddTopic(event) {
    event.preventDefault();
    setTopicError("");
    const minutes = Number(topicForm.estimated_minutes);
    if (!topicForm.name.trim()) {
      setTopicError("Topic name is required.");
      return;
    }
    if (minutes < 5 || minutes > 300) {
      setTopicError("Estimated time must be between 5 and 300 minutes.");
      return;
    }
    try {
      await onAddTopic(subject.id, {
        name: topicForm.name.trim(),
        estimated_minutes: minutes,
        difficulty: topicForm.difficulty,
      });
      setTopicForm({ name: "", estimated_minutes: 45, difficulty: "Medium" });
    } catch (error) {
      setTopicError(error.friendlyMessage || "Could not add the topic.");
    }
  }

  return (
    <div className="subject-card card">
      {/* Card header */}
      <div className="subject-head" onClick={() => setExpanded((v) => !v)}>
        <div style={{ minWidth: 0 }}>
          <h3>
            <span className="subject-marker" aria-hidden="true">{marker}</span>
            {subject.name}
          </h3>
          <div className="subject-badges">
            <span className={urgencyBadgeClass(subject.days_until_exam)}>
              {daysLeftLabel(subject.days_until_exam)}
            </span>
            <span className="badge badge-neutral">{subject.difficulty}</span>
            <span className="badge badge-neutral">{subject.preparation_percentage}% prepared</span>
          </div>
        </div>
        <div className="subject-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="icon-button"
            title="Edit subject"
            onClick={() => onEdit?.(subject)}
            style={{ fontSize: "0.75rem" }}
          >
            Edit
          </button>
          <button
            className="icon-button"
            title="Delete subject"
            onClick={() => onDelete?.(subject)}
            style={{ fontSize: "0.75rem" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="subject-progress">
        <ProgressBar value={progress} />
        <small>{completed}/{total} topics</small>
      </div>

      {/* Expanded: topic list */}
      {expanded && (
        <div className="topic-section">
          <ul className="topic-list">
            {(subject.topics || []).map((topic) => (
              <li key={topic.id} className={`topic-item ${topic.status === "completed" ? "done" : ""}`}>
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
                <button
                  className="icon-button"
                  title="Delete topic"
                  onClick={() => onDeleteTopic?.(topic)}
                  style={{ fontSize: "0.72rem" }}
                >
                  ✕
                </button>
              </li>
            ))}
            {total === 0 && (
              <li className="topic-empty">No topics yet. Add your first one below.</li>
            )}
          </ul>

          <form className="topic-form" onSubmit={handleAddTopic}>
            <input
              placeholder="Topic name (e.g. Normalization)"
              value={topicForm.name}
              onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
            />
            <input
              type="number"
              min="5"
              max="300"
              title="Estimated minutes (5–300)"
              value={topicForm.estimated_minutes}
              onChange={(e) => setTopicForm({ ...topicForm, estimated_minutes: e.target.value })}
            />
            <select
              value={topicForm.difficulty}
              onChange={(e) => setTopicForm({ ...topicForm, difficulty: e.target.value })}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
            <button type="submit" className="button secondary" style={{ padding: "8px 14px" }}>
              Add topic
            </button>
          </form>
          {topicError && <p className="field-error" style={{ marginTop: 8 }}>{topicError}</p>}
        </div>
      )}
    </div>
  );
}

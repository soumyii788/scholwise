import { useState } from "react";

const EMPTY = { name: "", exam_date: "", preparation_percentage: 0, difficulty: "Medium", notes: "" };

export default function SubjectFormModal({ subject, onClose, onSubmit }) {
  const [form, setForm] = useState(
    subject
      ? {
          name: subject.name,
          exam_date: subject.exam_date || "",
          preparation_percentage: subject.preparation_percentage,
          difficulty: subject.difficulty,
          notes: subject.notes || "",
        }
      : EMPTY
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.name.trim().length < 2) {
      setError("Subject name must be at least 2 characters.");
      return;
    }
    if (form.exam_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(`${form.exam_date}T00:00:00`) < today) {
        setError("Exam date must be today or in the future.");
        return;
      }
    }
    const prep = Number(form.preparation_percentage);
    if (Number.isNaN(prep) || prep < 0 || prep > 100) {
      setError("Preparation must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        exam_date: form.exam_date || null,
        preparation_percentage: prep,
        difficulty: form.difficulty,
        notes: form.notes.trim(),
      });
    } catch (submitError) {
      setError(submitError.friendlyMessage || "Could not save the subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{subject ? "Edit subject" : "Add subject"}</h2>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Subject name
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. DBMS"
              autoFocus
            />
          </label>

          <div className="form-row">
            <label>
              Exam date
              <input
                type="date"
                value={form.exam_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("exam_date", e.target.value)}
              />
            </label>

            <label>
              Difficulty
              <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
          </div>

          <label>
            Preparation level: <strong>{form.preparation_percentage}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={form.preparation_percentage}
              onChange={(e) => set("preparation_percentage", Number(e.target.value))}
            />
          </label>

          <label>
            Notes (optional)
            <textarea
              rows="2"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Chapters to focus on, reference books..."
            />
          </label>

          {error && <p className="field-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? "Saving..." : subject ? "Save changes" : "Add subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

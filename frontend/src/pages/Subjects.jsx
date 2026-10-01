import { useCallback, useEffect, useState } from "react";
import { subjectsApi, topicsApi, getErrorMessage } from "../services/api.js";
import Loading from "../components/Loading.jsx";
import SubjectCard from "../components/SubjectCard.jsx";
import SubjectFormModal from "../components/SubjectFormModal.jsx";

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [modal, setModal] = useState(null); // null | {mode: 'create'} | {mode:'edit', subject}
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setSubjects(await subjectsApi.list());
    } catch (err) {
      setBanner({ kind: "error", text: getErrorMessage(err, "Could not load subjects.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitSubject(payload) {
    if (modal?.mode === "edit") {
      await subjectsApi.update(modal.subject.id, payload);
      setBanner({ kind: "success", text: "Subject updated." });
    } else {
      await subjectsApi.create(payload);
      setBanner({ kind: "success", text: "Subject added." });
    }
    setModal(null);
    await load();
  }

  async function handleDeleteSubject(subject) {
    setConfirmDelete({ type: "subject", subject });
  }

  async function handleDeleteTopic(topic) {
    setConfirmDelete({ type: "topic", topic });
  }

  async function performDelete() {
    try {
      if (confirmDelete.type === "subject") {
        await subjectsApi.remove(confirmDelete.subject.id);
        setBanner({ kind: "success", text: "Subject deleted." });
      } else {
        await topicsApi.remove(confirmDelete.topic.id);
        setBanner({ kind: "success", text: "Topic deleted." });
      }
    } catch (err) {
      setBanner({ kind: "error", text: getErrorMessage(err, "Could not delete.") });
    } finally {
      setConfirmDelete(null);
      await load();
    }
  }

  async function handleAddTopic(subjectId, payload) {
    await topicsApi.create(subjectId, payload);
    await load();
  }

  async function handleToggleTopic(topic, completed) {
    try {
      await topicsApi.complete(topic.id, completed);
      await load();
    } catch (err) {
      setBanner({ kind: "error", text: getErrorMessage(err, "Could not update the topic.") });
    }
  }

  if (loading) return <Loading label="Loading subjects..." />;

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Subjects</h1>
          <p style={{ color: "var(--text-soft)" }}>
            Add subjects with exam dates, then break them into topics.
          </p>
        </div>
        <button className="button primary" onClick={() => setModal({ mode: "create" })}>
          + Add subject
        </button>
      </div>

      {banner && <div className={`form-banner ${banner.kind}`}>{banner.text}</div>}

      {subjects.length === 0 ? (
        <div className="card empty-state">
          <h2>No subjects yet</h2>
          <p>Add your first subject - the scheduler needs something to plan around!</p>
          <button className="button primary" onClick={() => setModal({ mode: "create" })}>
            + Add subject
          </button>
        </div>
      ) : (
        subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onAddTopic={handleAddTopic}
            onUpdateTopic={() => {}}
            onDeleteTopic={handleDeleteTopic}
            onToggleComplete={handleToggleTopic}
            onEdit={(subject) => setModal({ mode: "edit", subject })}
            onDelete={handleDeleteSubject}
          />
        ))
      )}

      {modal && (
        <SubjectFormModal
          subject={modal.subject}
          onClose={() => setModal(null)}
          onSubmit={handleSubmitSubject}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              Delete {confirmDelete.type === "subject" ? confirmDelete.subject.name : confirmDelete.topic.name}?
            </h2>
            {confirmDelete.type === "subject" && (
              <p style={{ color: "var(--text-soft)" }}>
                This also removes its topics and any generated sessions for them.
              </p>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="button ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="button danger" onClick={performDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

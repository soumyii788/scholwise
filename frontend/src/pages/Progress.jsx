import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { progressApi, getErrorMessage } from "../services/api.js";
import Loading from "../components/Loading.jsx";
import ProgressBar from "../components/ProgressBar.jsx";

export default function Progress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await progressApi.get());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load progress."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading progress..." />;
  if (error) return <div className="form-banner error">{error}</div>;

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Progress</h1>
          <p style={{ color: "var(--text-soft)" }}>How your preparation is trending.</p>
        </div>
      </div>

      <div className="card">
        <h2>Overall</h2>
        <ProgressBar value={data?.totals?.overall_progress ?? 0} />
        <div className="plan-summary">
          <span>Subjects <strong>{data?.totals?.subjects ?? 0}</strong></span>
          <span>Topics <strong>{data?.totals?.total_topics ?? 0}</strong></span>
          <span>Completed <strong>{data?.totals?.completed ?? 0}</strong></span>
          <span>Pending <strong>{data?.totals?.pending ?? 0}</strong></span>
        </div>
      </div>

      <div className="section progress-list">
        {(data?.subjects || []).length === 0 ? (
          <div className="card empty-state">
            <h2>Nothing to track yet</h2>
            <p>Add subjects and topics to start tracking your preparation.</p>
            <Link to="/subjects" className="button primary">Go to subjects</Link>
          </div>
        ) : (
          data.subjects.map((item) => (
            <div key={item.subject.id} className="card progress-row">
              <div className="progress-row-top">
                <strong>{item.subject.name}</strong>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge badge-neutral">{item.subject.difficulty}</span>
                  <small>
                    {item.completed}/{item.total_topics} topics
                  </small>
                </span>
              </div>
              <ProgressBar value={item.progress_percentage} />
              <small>
                {item.in_progress > 0 && `${item.in_progress} in progress · `}
                {item.pending} pending
              </small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

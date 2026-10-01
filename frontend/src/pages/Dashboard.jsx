import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  authApi,
  planApi,
  sessionsApi,
  getErrorMessage,
} from "../services/api.js";
import Loading from "../components/Loading.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import StudySessionRow from "../components/StudySession.jsx";
import { greetingForHour, firstName, formatDuration, daysLeftLabel, urgencyBadgeClass } from "../utils/helpers.js";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [plan, setPlan] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState(null);
  const [banner, setBanner] = useState(null);

  const notify = (kind, text) => setBanner({ kind, text });

  const loadAll = useCallback(async () => {
    try {
      const [statsData, planData] = await Promise.all([authApi.dashboardStats(), planApi.today()]);
      setStats(statsData);
      setPlan(planData.plan);
      setSummary(planData.summary);
    } catch (err) {
      notify("error", getErrorMessage(err, "Could not load your dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleGenerate() {
    setGenerating(true);
    setBanner(null);
    setAiContent(null);
    try {
      const data = await planApi.generate();
      setPlan(data.plan);
      const planData = await planApi.today();
      setPlan(planData.plan);
      setSummary(planData.summary);
      setStats(await authApi.dashboardStats());
      notify("success", data.message || "Your study plan for today is ready!");
    } catch (err) {
      notify("error", getErrorMessage(err, "Could not generate your plan."));
    } finally {
      setGenerating(false);
    }
  }

  async function handleAi(kind) {
    setAiLoading(true);
    setAiContent(null);
    try {
      const data = kind === "explain" ? await planApi.explain() : await planApi.suggestions();
      setAiContent(data);
    } catch (err) {
      notify("error", getErrorMessage(err, "AI request failed."));
    } finally {
      setAiLoading(false);
    }
  }

  async function handleToggleSession(session) {
    const nextStatus = session.status === "completed" ? "pending" : "completed";
    try {
      const updated = await sessionsApi.setStatus(session.id, nextStatus);
      setPlan((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      setStats(await authApi.dashboardStats());
      if (nextStatus === "completed") {
        const planData = await planApi.today();
        setSummary(planData.summary);
      }
    } catch (err) {
      notify("error", getErrorMessage(err, "Could not update the session."));
    }
  }

  if (loading) return <Loading label="Loading your dashboard..." />;

  const completedSessions = (plan || []).filter(
    (s) => !s.is_break && s.status === "completed"
  ).length;
  const totalSessions = (plan || []).filter((s) => !s.is_break).length;

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>
            {greetingForHour()}, {firstName(user?.name)} 👋
          </h1>
          <p style={{ color: "var(--text-soft)" }}>Let's get some studying done today.</p>
        </div>
      </div>

      {banner && <div className={`form-banner ${banner.kind}`}>{banner.text}</div>}

      {/* ---- Stats ---- */}
      <div className="card-grid">
        <div className="card stat-card">
          <div className="stat-value">{stats?.subjects ?? 0}</div>
          <div className="stat-label">Subjects</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.upcoming_exams?.length ?? 0}</div>
          <div className="stat-label">Upcoming exams</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.topics?.pending ?? 0}</div>
          <div className="stat-label">Pending topics</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.topics?.completed ?? 0}</div>
          <div className="stat-label">Completed topics</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{formatDuration(stats?.today_minutes || 0)}</div>
          <div className="stat-label">Planned today</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.overall_progress ?? 0}%</div>
          <div className="stat-label">Overall progress</div>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <div className="section-head">
            <h2>Today's Study Plan</h2>
            <small>
              {completedSessions}/{totalSessions} sessions done
            </small>
          </div>

          {summary?.planned && (
            <ProgressBar
              value={summary.study_minutes ? (summary.completed_minutes / summary.study_minutes) * 100 : 0}
              showLabel={false}
            />
          )}

          {!summary?.planned ? (
            <div className="plan-empty">
              <p>No plan for today yet.</p>
              <p>Add your subjects and topics, then generate a personalized schedule.</p>
            </div>
          ) : (
            <div className="session-list" style={{ marginTop: 14 }}>
              {plan.map((session) => (
                <StudySessionRow
                  key={session.id}
                  session={session}
                  onToggle={handleToggleSession}
                />
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <button
              className="button primary large"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Creating your study plan..." : "Generate My Study Plan"}
            </button>
            {summary?.planned && (
              <button className="button secondary" onClick={() => handleAi("suggestions")} disabled={aiLoading}>
                ✨ Improve Plan with AI
              </button>
            )}
            {summary?.planned && (
              <button className="button ghost" onClick={() => handleAi("explain")} disabled={aiLoading}>
                Why this plan?
              </button>
            )}
          </div>

          {aiLoading && <Loading label="Asking the AI coach..." />}
          {aiContent && !aiLoading && (
            <div className="ai-box">
              {aiContent.ai_available === false && <p>{aiContent.detail}</p>}
              {aiContent.explanation && <p>{aiContent.explanation}</p>}
              {aiContent.suggestions && (
                <>
                  <h3>✨ AI suggestions</h3>
                  <ul>
                    {aiContent.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </>
              )}
              {aiContent.detail && aiContent.suggestions && <p><small>{aiContent.detail}</small></p>}
            </div>
          )}

          {summary?.planned && (
            <div className="plan-summary">
              <span>📖 Study: <strong>{formatDuration(summary.study_minutes)}</strong></span>
              <span>☕ Breaks: <strong>{formatDuration(summary.break_minutes)}</strong></span>
              <span>✅ Done: <strong>{formatDuration(summary.completed_minutes)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ---- Exams ---- */}
      <div className="section">
        <div className="card">
          <div className="section-head">
            <h2>Upcoming Exams</h2>
            <Link to="/subjects">Manage subjects →</Link>
          </div>
          {(stats?.upcoming_exams || []).length === 0 ? (
            <p className="empty-state">No upcoming exams. Add subjects with exam dates to see them here.</p>
          ) : (
            stats.upcoming_exams.map((exam) => (
              <div key={exam.id} className="exam-row">
                <strong>{exam.name}</strong>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <small>{exam.exam_date}</small>
                  <span className={urgencyBadgeClass(exam.days_until)}>
                    {daysLeftLabel(exam.days_until)}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

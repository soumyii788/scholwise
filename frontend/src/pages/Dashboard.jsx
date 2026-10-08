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
import SmartInsights from "../components/SmartInsights.jsx";
import { firstName, formatDuration, daysLeftLabel, urgencyBadgeClass } from "../utils/helpers.js";

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="focus-ring" role="img" aria-label={`${pct}% of today's plan complete`}>
      <svg width="100%" height="100%" viewBox="0 0 96 96">
        <circle className="focus-ring-track" cx="48" cy="48" r={RING_RADIUS} />
        <circle
          className="focus-ring-fill"
          cx="48"
          cy="48"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
        />
      </svg>
      <span className="focus-ring-label">{pct}%</span>
    </div>
  );
}

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

  useEffect(() => { loadAll(); }, [loadAll]);

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
      notify("success", data.message || "Your study plan for today is ready.");
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

  if (loading) return <Loading label="Loading your workspace..." />;

  const completedSessions = (plan || []).filter(
    (s) => !s.is_break && s.status === "completed"
  ).length;
  const totalSessions = (plan || []).filter((s) => !s.is_break).length;

  const progressPct = summary?.study_minutes
    ? Math.round((summary.completed_minutes / summary.study_minutes) * 100)
    : 0;

  // First non-completed non-break session — "Today's Focus"
  const focusSession = plan
    ? plan.find((s) => !s.is_break && s.status !== "completed")
    : null;

  return (
    <div>
      {/* ── Greeting ── */}
      <div className="dash-greeting">
        <div className="dash-date">{todayLabel()}</div>
        <h1>Hey, {firstName(user?.name)}.</h1>
        <p style={{ color: "var(--text-soft)", marginTop: 4, fontSize: "0.9rem" }}>
          {summary?.planned
            ? completedSessions === totalSessions && totalSessions > 0
              ? "All sessions done. Well studied."
              : "Let's get something done."
            : "No plan yet. Generate one below."}
        </p>
      </div>

      {banner && <div className={`form-banner ${banner.kind}`}>{banner.text}</div>}

      {/* ── Today's Focus ── */}
      {summary?.planned && focusSession && (
        <div className="focus-card" style={{ marginBottom: 24 }}>
          <div className="focus-grid">
            <div className="focus-info">
              <div className="focus-label">Today's Focus</div>
              <h2>{focusSession.subject_name || "Study"}</h2>
              <p style={{ color: "var(--text-soft)", fontSize: "0.86rem", marginBottom: 0 }}>
                {focusSession.topic_name || focusSession.label || "Review session"}
                {" · "}
                {formatDuration(focusSession.duration)}
              </p>
              <div className="focus-meta-row">
                <span className="focus-progress-text">
                  {completedSessions} of {totalSessions} sessions done
                </span>
                <button
                  className="button primary"
                  onClick={() => handleToggleSession(focusSession)}
                  style={{ padding: "7px 16px", fontSize: "0.82rem" }}
                >
                  Mark complete
                </button>
              </div>
            </div>
            <ProgressRing value={progressPct} />
          </div>
        </div>
      )}

      {/* ── Stats row (compact) ── */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-value">{stats?.subjects ?? 0}</div>
          <div className="stat-label">Subjects</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.topics?.completed ?? 0}</div>
          <div className="stat-label">Topics done</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.topics?.pending ?? 0}</div>
          <div className="stat-label">Remaining</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: stats?.overall_progress > 0 ? "var(--primary)" : undefined }}>
            {stats?.overall_progress ?? 0}%
          </div>
          <div className="stat-label">Overall</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{formatDuration(stats?.today_minutes || 0)}</div>
          <div className="stat-label">Planned today</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats?.upcoming_exams?.length ?? 0}</div>
          <div className="stat-label">Exams upcoming</div>
        </div>
      </div>

      {/* ── Study Insights ── */}
      <div className="section">
        <div className="card">
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div>
              <p className="section-label">Study Insights</p>
              <h2 style={{ marginBottom: 0 }}>What the data says</h2>
            </div>
            <small style={{ color: "var(--text-muted)" }}>Based on your subjects &amp; topics</small>
          </div>
          <SmartInsights />
        </div>
      </div>

      {/* ── Today's Study Plan ── */}
      <div className="section">
        <div className="card">
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <p className="section-label">Study Plan</p>
              <h2 style={{ marginBottom: 0 }}>Today's sessions</h2>
            </div>
            <small style={{ color: "var(--text-muted)" }}>
              {summary?.planned ? `${completedSessions}/${totalSessions} done` : "No plan yet"}
            </small>
          </div>

          {summary?.planned && (
            <ProgressBar
              value={progressPct}
              showLabel={false}
            />
          )}

          {!summary?.planned ? (
            <div className="plan-empty">
              <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No plan for today.</p>
              <p>Add subjects and topics, then generate your personalized schedule.</p>
            </div>
          ) : (
            <div className="session-list session-timeline" style={{ marginTop: 16 }}>
              {plan.map((session) => (
                <StudySessionRow
                  key={session.id}
                  session={session}
                  onToggle={handleToggleSession}
                />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button
              className="button primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Building your plan..." : "Generate study plan"}
            </button>
            {summary?.planned && (
              <button
                className="button ghost"
                onClick={() => handleAi("suggestions")}
                disabled={aiLoading}
              >
                Improve with AI
              </button>
            )}
            {summary?.planned && (
              <button
                className="button ghost"
                onClick={() => handleAi("explain")}
                disabled={aiLoading}
              >
                Why this plan?
              </button>
            )}
          </div>

          {aiLoading && <Loading label="Consulting the AI coach..." />}

          {aiContent && !aiLoading && (
            <div className="ai-box" style={{ marginTop: 16 }}>
              <div className="ai-box-label">study note</div>
              {aiContent.ai_available === false && <p>{aiContent.detail}</p>}
              {aiContent.explanation && <p>{aiContent.explanation}</p>}
              {aiContent.suggestions && (
                <>
                  <h3 style={{ fontSize: "0.88rem", marginBottom: 6 }}>Suggestions</h3>
                  <ul>
                    {aiContent.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </>
              )}
              {aiContent.detail && aiContent.suggestions && (
                <p style={{ marginTop: 6 }}><small>{aiContent.detail}</small></p>
              )}
            </div>
          )}

          {summary?.planned && (
            <div className="plan-summary">
              <span>Study <strong>{formatDuration(summary.study_minutes)}</strong></span>
              <span>Breaks <strong>{formatDuration(summary.break_minutes)}</strong></span>
              <span>Completed <strong>{formatDuration(summary.completed_minutes)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming Exams ── */}
      <div className="section">
        <div className="card">
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <p className="section-label">Upcoming</p>
              <h2 style={{ marginBottom: 0 }}>Exams</h2>
            </div>
            <Link to="/subjects" style={{ fontSize: "0.8rem", color: "var(--text-muted)", textDecoration: "none" }}>
              Manage subjects →
            </Link>
          </div>

          {(stats?.upcoming_exams || []).length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <p style={{ color: "var(--text-muted)" }}>No upcoming exams.</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Add subjects with exam dates to see them here.
              </p>
            </div>
          ) : (
            stats.upcoming_exams.map((exam) => (
              <div key={exam.id} className="exam-row">
                <strong>{exam.name}</strong>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <small style={{ color: "var(--text-muted)" }}>{exam.exam_date}</small>
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

import { useState } from "react";
import { firstName, formatDuration } from "../utils/helpers.js";

export default function RetroStudyHero({
  user,
  stats,
  summary,
  plan,
  generating,
  onGenerate,
}) {
  const [hoverTag, setHoverTag] = useState(false);

  const completedSessions = (plan || []).filter(
    (s) => !s.is_break && s.status === "completed"
  ).length;
  const totalSessions = (plan || []).filter((s) => !s.is_break).length;

  return (
    <div className="retro-portal-hero">
      {/* Hanging Red Label Tag (Signature retro element) */}
      <div
        className={`retro-hanging-tag ${hoverTag ? "swaying" : ""}`}
        onMouseEnter={() => setHoverTag(true)}
        onMouseLeave={() => setHoverTag(false)}
        title="Scholarwise Study Portal"
      >
        <div className="retro-tag-stitch" />
        <span className="retro-tag-text">SCHOLAWISE</span>
        <span className="retro-tag-sub">EST. 2026</span>
      </div>

      <div className="retro-hero-grid">
        {/* Left: Dynamic Action / Surfer Splash Hero */}
        <div className="retro-hero-action">
          <div className="retro-hero-bg-media" />
          
          {/* Animated Water Spray Particles */}
          <div className="retro-water-spray" aria-hidden="true">
            <span className="spray-drop drop-1" />
            <span className="spray-drop drop-2" />
            <span className="spray-drop drop-3" />
            <span className="spray-drop drop-4" />
            <span className="spray-drop drop-5" />
            <span className="spray-drop drop-6" />
          </div>

          {/* Floating Vibe Badge */}
          <div className="retro-action-overlay">
            <div className="retro-surf-pill">
              <span className="retro-wave-icon">✨</span>
              <span>EVENING FLOW · 07:35</span>
            </div>
            <div className="retro-action-caption">
              Cozy high-focus study desk
            </div>
          </div>
        </div>

        {/* Center: Torn Paper Divider Edge */}
        <div className="retro-torn-divider" aria-hidden="true">
          <svg
            className="retro-torn-svg"
            viewBox="0 0 24 600"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 L14,35 L5,72 L19,115 L8,155 L22,200 L9,245 L24,290 L7,335 L20,380 L11,425 L24,470 L9,515 L21,560 L14,600 L24,600 L24,0 Z"
              fill="var(--cream-bg, #F5EFE6)"
            />
          </svg>
        </div>

        {/* Right: Vintage Cream Canvas with Bold Red Typography */}
        <div className="retro-hero-content">
          <div className="retro-kicker-row">
            <span className="retro-badge-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="retro-pill-status">
              {summary?.planned ? "⚡ PLAN ACTIVE" : "🎯 READY TO PLAN"}
            </span>
          </div>

          <h1 className="retro-hero-title">
            <span className="title-line-1">Study Portal</span>
            <span className="title-line-2">&amp; Daily Planner</span>
          </h1>

          <p className="retro-hero-subtitle">
            Hey, <strong>{firstName(user?.name)}</strong> — Ride the wave of your study goals with AI schedules, urgency filters, and zero burnout.
          </p>

          {/* Stats Bar */}
          <div className="retro-hero-stats">
            <div className="retro-stat-pill">
              <span className="stat-num">{stats?.overall_progress ?? 0}%</span>
              <span className="stat-desc">Progress</span>
            </div>
            <div className="retro-stat-pill">
              <span className="stat-num">
                {completedSessions}/{totalSessions}
              </span>
              <span className="stat-desc">Sessions Done</span>
            </div>
            <div className="retro-stat-pill">
              <span className="stat-num">
                {stats?.upcoming_exams?.length ?? 0}
              </span>
              <span className="stat-desc">Upcoming Exams</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="retro-hero-cta">
            <button
              className="button retro-btn-primary"
              onClick={onGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <span className="btn-spinner" /> Generating Plan...
                </>
              ) : (
                <>
                  <span>⚡</span> {summary?.planned ? "Regenerate Today's Plan" : "Generate Today's Plan"}
                </>
              )}
            </button>
            <a href="#sessions-section" className="button retro-btn-outline">
              View Sessions ↓
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { authApi } from "../services/api.js";

/**
 * SmartInsights — compact insight cards rendered on the Dashboard.
 *
 * Fetches from /api/dashboard/insights/ which uses real subject/topic data
 * + the existing priority engine. AI tip appears only when AI_API_KEY is set.
 */
export default function SmartInsights() {
  const [data, setData] = useState(null);   // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .smartInsights()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (data === null && !error) {
    return (
      <div className="insights-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="insight-card insight-skeleton">
            <div className="insight-skeleton-icon" />
            <div className="insight-skeleton-body">
              <div className="insight-skeleton-line insight-skeleton-short" />
              <div className="insight-skeleton-line insight-skeleton-long" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <p className="insights-empty">
        Could not load insights right now — your plan and data are unaffected.
      </p>
    );
  }

  // ── Empty state (no subjects / all topics done) ───────────────────────
  if (data.empty || !data.insights?.length) {
    return (
      <p className="insights-empty">
        Add subjects and topics to see personalised study insights here.
      </p>
    );
  }

  return (
    <div className="insights-grid">
      {data.insights.map((insight) => (
        <div key={insight.id} className="insight-card">
          <span className="insight-icon" aria-hidden="true">
            {insight.icon}
          </span>
          <div className="insight-body">
            <p className="insight-label">{insight.label}</p>
            <p className="insight-value">{insight.value}</p>
            {insight.sub && (
              <p className="insight-sub">{insight.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

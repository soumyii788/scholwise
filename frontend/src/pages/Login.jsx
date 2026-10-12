import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Could not sign you in. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        {/* Hanging Red Label Tag */}
        <div className="retro-hanging-tag" title="Scholarwise Study Portal">
          <div className="retro-tag-stitch" />
          <span className="retro-tag-text">SCHOLAWISE</span>
          <span className="retro-tag-sub">EST. 2026</span>
        </div>

        {/* Action / Surfer Splash Layer */}
        <div className="auth-action-visual">
          <div className="auth-media-bg" />
          <div className="retro-water-spray" aria-hidden="true">
            <span className="spray-drop drop-1" />
            <span className="spray-drop drop-2" />
            <span className="spray-drop drop-3" />
            <span className="spray-drop drop-4" />
          </div>
          <div className="retro-surf-pill">
            <span>🌊</span>
            <span>RIDE THE WAVE</span>
          </div>
        </div>

        {/* Torn Paper Divider Edge */}
        <div className="auth-torn-divider" aria-hidden="true">
          <svg className="retro-torn-svg" viewBox="0 0 24 600" preserveAspectRatio="none">
            <path
              d="M0,0 L14,35 L5,72 L19,115 L8,155 L22,200 L9,245 L24,290 L7,335 L20,380 L11,425 L24,470 L9,515 L21,560 L14,600 L24,600 L24,0 Z"
              fill="var(--cream-bg, #F5EFE6)"
            />
          </svg>
        </div>

        {/* Right Side: Cream Paper Content */}
        <div className="auth-visual-content">
          <div>
            <div className="auth-visual-kicker">Scholarwise · Study Portal</div>
            <h2 className="retro-hero-title auth-retro-title">
              <span className="title-line-1">Study Portal</span>
              <span className="title-line-2">&amp; Repairs</span>
            </h2>
            <p className="auth-visual-sub">
              Fix your study routine, plan around exam urgency, and turn chaos into unstoppable focus.
            </p>
            <ul className="auth-points">
              <li>A realistic plan in one click</li>
              <li>Breaks and revision scheduled for you</li>
              <li>Progress you can see, subject by subject</li>
            </ul>
          </div>

          <div className="auth-mock-stack" aria-hidden="true">
            <div className="auth-mock">
              <div className="auth-mock-title">Today's plan</div>
              <div className="auth-mock-row">
                <strong>8:40 PM · Graph Traversal</strong>
                <span>50m</span>
              </div>
              <div className="auth-mock-row">
                <strong>9:30 PM · Revision — Data Structures</strong>
                <span>30m</span>
              </div>
            </div>
            <div className="auth-mock auth-mock-secondary">
              <div className="auth-mock-title">Next exam</div>
              <div className="auth-mock-row">
                <strong>Data Structures</strong>
                <span>12 days</span>
              </div>
              <div className="auth-mock-row">
                <strong>Overall progress</strong>
                <span>46%</span>
              </div>
            </div>
          </div>

          <p className="auth-visual-foot">
            Works with or without an AI key — the planner never needs one.
          </p>
        </div>
      </aside>

      <div className="auth-side">
        <div className="auth-card">
          <div className="auth-card-top-tag">
            <span>PORTAL ACCESS</span>
          </div>
          <h1>
            <span className="brand-mark retro-nav-tag">
              <span className="retro-nav-tag-text">SW</span>
            </span>
            Scholarwise
          </h1>
          <p className="auth-sub">Welcome back! Log in to see today's study plan.</p>

          {error && <div className="form-banner error">{error}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="student@example.com"
                autoComplete="email"
                autoFocus
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </label>

            <button className="button primary large block" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>

          <p className="auth-alt">
            New to Scholarwise? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

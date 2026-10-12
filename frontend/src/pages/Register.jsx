import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.name.trim().length < 2) return setError("Enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      return setError("Enter a valid email address.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm_password)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create your account. Please try again."));
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
            <span>🏄</span>
            <span>CATCH THE STUDY WAVE</span>
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
              A study plan you'll actually follow. Prioritized by urgency, gaps, and the real hours you have.
            </p>
            <ul className="auth-points">
              <li>Prioritized by urgency, gaps and difficulty</li>
              <li>Long topics split into focused 50-minute blocks</li>
              <li>Revision reserved for what's slipping</li>
            </ul>
          </div>

          <div className="auth-mock-stack" aria-hidden="true">
            <div className="auth-mock">
              <div className="auth-mock-title">This week</div>
              <div className="auth-mock-row">
                <strong>Data Structures · exam</strong>
                <span>12 days</span>
              </div>
              <div className="auth-mock-row">
                <strong>Overall progress</strong>
                <span>46%</span>
              </div>
            </div>
            <div className="auth-mock auth-mock-secondary">
              <div className="auth-mock-title">Today's plan</div>
              <div className="auth-mock-row">
                <strong>8:40 PM · Graph Traversal</strong>
                <span>50m</span>
              </div>
              <div className="auth-mock-row">
                <strong>9:30 PM · Revision</strong>
                <span>30m</span>
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
            <span>GET STARTED</span>
          </div>
          <h1>
            <span className="brand-mark retro-nav-tag">
              <span className="retro-nav-tag-text">SW</span>
            </span>
            Scholarwise
          </h1>
          <p className="auth-sub">Create your account and never cram the night before again.</p>

          {error && <div className="form-banner error">{error}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Full name
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Soumya Shukla"
                autoFocus
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="student@example.com"
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => set("confirm_password", e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </label>

            <button className="button primary large block" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="auth-alt">
            Already have a Scholarwise account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

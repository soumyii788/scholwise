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
        <div>
          <div className="auth-visual-kicker">ScholaWise · Study Planner</div>
          <h2>A study plan you'll actually follow.</h2>
          <p className="auth-visual-sub">
            Tell us your subjects, exam dates and how many hours you have.
            We turn them into a practical day — starting today.
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
      </aside>

      <div className="auth-side">
        <div className="auth-card">
          <h1><span className="brand-mark">SW</span> Scholarwise</h1>
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
            Already have a ScholaWise account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

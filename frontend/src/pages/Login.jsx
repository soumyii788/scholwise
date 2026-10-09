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
        <div>
          <div className="auth-visual-kicker">ScholaWise · Study Planner</div>
          <h2>What should I study today?</h2>
          <p className="auth-visual-sub">
            Your day, planned around exam urgency, how prepared you really
            are, and the hours you actually have.
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
      </aside>

      <div className="auth-side">
        <div className="auth-card">
          <h1><span className="brand-mark">SW</span> Scholarwise</h1>
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
            New to ScholaWise? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

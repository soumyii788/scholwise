import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, getErrorMessage } from "../services/api.js";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    daily_study_hours: user?.daily_study_hours || 4,
    preferred_start_time: user?.preferred_start_time || "18:00",
    preferred_end_time: user?.preferred_end_time || "22:00",
  });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setBanner(null);

    const hours = Number(form.daily_study_hours);
    if (hours < 1 || hours > 16) {
      setBanner({ kind: "error", text: "Daily study hours must be between 1 and 16." });
      return;
    }
    if (form.preferred_start_time >= form.preferred_end_time) {
      setBanner({ kind: "error", text: "Study start time must be before the end time." });
      return;
    }

    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        name: form.name.trim(),
        daily_study_hours: hours,
        preferred_start_time: form.preferred_start_time,
        preferred_end_time: form.preferred_end_time,
      });
      updateUser(updated);
      setBanner({ kind: "success", text: "Profile saved. Your next plan will use these settings." });
    } catch (err) {
      setBanner({ kind: "error", text: getErrorMessage(err, "Could not save your profile.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setBanner(null);

    if (passwords.new_password.length < 8) {
      setBanner({ kind: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      setBanner({ kind: "error", text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      await authApi.updateProfile({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password,
      });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      setBanner({ kind: "success", text: "Password updated." });
    } catch (err) {
      setBanner({ kind: "error", text: getErrorMessage(err, "Could not change your password.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Profile</h1>
          <p style={{ color: "var(--text-soft)" }}>{user?.email}</p>
        </div>
      </div>

      {banner && <div className={`form-banner ${banner.kind}`}>{banner.text}</div>}

      <div className="card">
        <h2>Study preferences</h2>
        <form onSubmit={handleSave} className="form-grid" style={{ maxWidth: 480 }}>
          <label>
            Full name
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>

          <label>
            Daily study hours (1-16)
            <input
              type="number"
              min="1"
              max="16"
              step="0.5"
              value={form.daily_study_hours}
              onChange={(e) => set("daily_study_hours", e.target.value)}
            />
          </label>

          <div className="form-row">
            <label>
              Preferred start
              <input
                type="time"
                value={form.preferred_start_time}
                onChange={(e) => set("preferred_start_time", e.target.value)}
              />
            </label>
            <label>
              Preferred end
              <input
                type="time"
                value={form.preferred_end_time}
                onChange={(e) => set("preferred_end_time", e.target.value)}
              />
            </label>
          </div>

          <div>
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save preferences"}
            </button>
          </div>
        </form>
      </div>

      <div className="section card">
        <h2>Change password</h2>
        <form onSubmit={handleChangePassword} className="form-grid" style={{ maxWidth: 480 }}>
          <label>
            Current password
            <input
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={passwords.new_password}
              onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={passwords.confirm_password}
              onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
              autoComplete="new-password"
            />
          </label>
          <div>
            <button className="button secondary" type="submit" disabled={saving}>
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

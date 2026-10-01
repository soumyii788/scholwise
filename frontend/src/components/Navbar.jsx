import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi, getErrorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { firstName } from "../utils/helpers.js";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);

  async function loadNotifications() {
    try {
      const data = await notificationsApi.list();
      setNotifications(data.notifications);
      setUnread(data.unread_count);
    } catch {
      // Non-critical; ignore bell errors.
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleRead(id) {
    try {
      await notificationsApi.markRead(id);
      loadNotifications();
    } catch {
      // ignore
    }
  }

  async function handleMarkAll() {
    try {
      await notificationsApi.markAllRead();
      loadNotifications();
    } catch {
      // ignore
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const typeIcons = { exam: "⚠️", reminder: "⏰", progress: "📚", system: "💡" };

  return (
    <header className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <span className="brand-mark">SF</span> StudyFlow
      </Link>

      <div className="navbar-actions">
        <div className="notif-wrap" ref={bellRef}>
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) loadNotifications();
            }}
          >
            🔔
            {unread > 0 && <span className="notif-dot">{unread}</span>}
          </button>

          {open && (
            <div className="notif-panel">
              <div className="notif-head">
                <strong>Notifications</strong>
                {notifications.length > 0 && (
                  <button className="link-button" onClick={handleMarkAll}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="notif-empty">You're all caught up 🎉</p>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`notif-item ${n.is_read ? "read" : "unread"}`}
                      onClick={() => !n.is_read && handleRead(n.id)}
                    >
                      <span>{typeIcons[n.type] || "🔔"}</span>
                      <div>
                        <p>{n.message}</p>
                        <small>{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="profile-menu">
          <button className="profile-chip" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar">{firstName(user?.name)?.[0]?.toUpperCase() || "S"}</span>
            <span className="profile-name">{firstName(user?.name)}</span>
          </button>
          {menuOpen && (
            <div className="profile-dropdown">
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile 👤</Link>
              <button onClick={handleLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

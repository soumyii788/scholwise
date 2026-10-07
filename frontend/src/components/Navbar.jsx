import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { firstName } from "../utils/helpers.js";

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5a4.5 4.5 0 0 1 4.5 4.5c0 2 .5 3 1.5 4H2c1-1 1.5-2 1.5-4A4.5 4.5 0 0 1 7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M6 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);

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
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
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

  const typeLabels = { exam: "exam", reminder: "reminder", progress: "progress", system: "note" };

  return (
    <header className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <span className="brand-mark">SW</span>
        Scholawise
      </Link>

      <div className="navbar-actions">
        {/* Bell */}
        <div className="notif-wrap" ref={bellRef}>
          <button
            className="icon-button"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) loadNotifications();
            }}
          >
            <BellIcon />
            {unread > 0 && <span className="notif-dot">{unread}</span>}
          </button>

          {open && (
            <div className="notif-panel">
              <div className="notif-head">
                <strong style={{ fontSize: "0.84rem" }}>Notifications</strong>
                {notifications.length > 0 && (
                  <button className="link-button" onClick={handleMarkAll}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="notif-empty">You're all caught up.</p>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`notif-item ${n.is_read ? "read" : "unread"}`}
                      onClick={() => !n.is_read && handleRead(n.id)}
                    >
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

        {/* Profile */}
        <div className="profile-menu" ref={menuRef}>
          <button className="profile-chip" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar">{firstName(user?.name)?.[0]?.toUpperCase() || "S"}</span>
            <span className="profile-name">{firstName(user?.name)}</span>
            <ChevronIcon />
          </button>
          {menuOpen && (
            <div className="profile-dropdown">
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Settings</Link>
              <button onClick={handleLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

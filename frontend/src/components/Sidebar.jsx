import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { firstName } from "../utils/helpers.js";

// SVG icon set — lightweight, no emoji, no icon library dependency
function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5L1.5 7H3v6h3.5v-3.5h2V13H12V7h1.5L7.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
function SubjectsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="8" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="3" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M5 1.5V4M10 1.5V4M1.5 6.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function ProgressIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 11L5.5 7.5L8.5 10L13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 1.5v1.25M7.5 12.25v1.25M1.5 7.5h1.25M12.25 7.5h1.25M3.44 3.44l.88.88M10.68 10.68l.88.88M3.44 11.56l.88-.88M10.68 4.32l.88-.88" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

const navLinks = [
  { to: "/dashboard", label: "Home",     Icon: HomeIcon },
  { to: "/subjects",  label: "Subjects", Icon: SubjectsIcon },
  { to: "/calendar",  label: "Schedule", Icon: CalendarIcon },
  { to: "/progress",  label: "Progress", Icon: ProgressIcon },
  { to: "/profile",   label: "Settings", Icon: SettingsIcon },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <nav aria-label="Main navigation">
        {navLinks.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <span className="sidebar-icon">
              <Icon />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="avatar">{firstName(user?.name)?.[0]?.toUpperCase() || "S"}</span>
            <div>
              <div className="sidebar-user-name">{firstName(user?.name)}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

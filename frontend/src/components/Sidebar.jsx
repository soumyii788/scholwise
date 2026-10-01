import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/subjects", label: "Subjects", icon: "📚" },
  { to: "/calendar", label: "Calendar", icon: "🗓️" },
  { to: "/progress", label: "Progress", icon: "📈" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <span className="sidebar-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

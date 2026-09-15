import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, FileStack, Users, Boxes, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Stock dashboard", icon: LayoutGrid, end: true },
  { to: "/proformas", label: "Proformas", icon: FileStack },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/materials", label: "Materials", icon: Boxes },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-quarry-50">
      <aside className="flex w-60 flex-col border-r border-quarry-200 bg-quarry-900 text-quarry-100">
        <div className="px-5 py-6">
          <div className="text-lg font-semibold tracking-tight text-white">Fikat</div>
          <div className="text-sm text-quarry-400">Proforma & stock</div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-moss-600 text-white"
                    : "text-quarry-300 hover:bg-quarry-800 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-quarry-800 px-4 py-4">
          <div className="mb-2 text-sm text-quarry-200">{user?.name}</div>
          <div className="mb-3 text-xs text-quarry-500">{user?.role}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-quarry-400 hover:text-white"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

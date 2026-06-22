// ============================================================
//  layouts/ParentLayout.tsx
//  Shared shell for every page inside the Parent Dashboard
//  module: left sidebar nav (desktop) / top bar + drawer
//  (mobile), with the page content rendered via <Outlet />.
// ============================================================
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  HiOutlineSquares2X2,
  HiOutlineReceiptPercent,
  HiOutlineUserGroup,
  HiOutlineUserCircle,
  HiOutlineArrowLeftOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineHome,
  HiOutlineChatBubbleLeftRight,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: HiOutlineSquares2X2, end: true },
  { label: "Purchase History", to: "/dashboard/purchases", icon: HiOutlineReceiptPercent },
  { label: "My Students", to: "/dashboard/students", icon: HiOutlineUserGroup },
  { label: "Messages", to: "/dashboard/messages", icon: HiOutlineChatBubbleLeftRight },
  { label: "Profile", to: "/dashboard/profile", icon: HiOutlineUserCircle },
];

function ParentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* ── Desktop Sidebar ───────────────────────────────── */}
      <aside className="hidden lg:flex w-72 flex-col bg-[var(--outfield)] text-white sticky top-0 h-screen">
        <div className="p-6 border-b border-white/10">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm border-2 border-[var(--gold)] group-hover:scale-105 transition-transform">
              CCA
            </div>
            <div className="text-left">
              <p className="font-bold text-sm leading-tight">California Cricket Academy</p>
              <p className="text-xs text-white/50 font-medium tracking-wide">Parent Portal</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--gold)] text-[var(--outfield)] shadow-lg shadow-[var(--shadow-gold)]"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          <NavLink
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all mt-2"
          >
            <HiOutlineHome className="h-5 w-5 flex-shrink-0" />
            Back to Website
          </NavLink>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/40 flex items-center justify-center font-bold text-sm text-[var(--gold)]">
              {initials || "P"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <HiOutlineArrowLeftOnRectangle className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 bg-[var(--outfield)] text-white">
        <div className="h-16 px-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs border-2 border-[var(--gold)]">
              CCA
            </div>
            <p className="font-bold text-sm">Parent Portal</p>
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl border border-white/15"
            aria-label="Open menu"
          >
            <HiOutlineBars3 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--outfield)] text-white flex flex-col shadow-2xl">
            <div className="p-5 flex items-center justify-between border-b border-white/10">
              <p className="font-bold text-sm">Menu</p>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl border border-white/15" aria-label="Close menu">
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/40 flex items-center justify-center font-bold text-sm text-[var(--gold)]">
                {initials || "P"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
            </div>
            <nav className="flex-1 px-4 py-5 space-y-1">
              {navItems.map(({ label, to, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                      isActive ? "bg-[var(--gold)] text-[var(--outfield)]" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
              <NavLink
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all mt-2"
              >
                <HiOutlineHome className="h-5 w-5 flex-shrink-0" />
                Back to Website
              </NavLink>
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <HiOutlineArrowLeftOnRectangle className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default ParentLayout;

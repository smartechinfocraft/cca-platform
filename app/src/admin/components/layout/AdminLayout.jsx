// ============================================================
//  components/layout/AdminLayout.js
//  Main shell with sidebar navigation + top header
//  Outlet renders the current page in the content area
//  REPLACE: app/src/admin/components/layout/AdminLayout.jsx
// ============================================================
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Navigation items
// superOnly:true → only shown to SUPER_ADMIN users
// NOTE: Batches removed — batch logic is now inside Programs page
const NAV_ITEMS = [
  { path: '/admin/dashboard',        label: 'Dashboard',        icon: '🏠', superOnly: false },
  // ── Super Admin section ──
  { path: '/admin/programs',         label: 'Programs',         icon: '🏏', superOnly: true  },
  { path: '/admin/categories',       label: 'Categories',       icon: '📁', superOnly: true  },
  { path: '/admin/locations',        label: 'Locations',        icon: '📍', superOnly: true  },
  { path: '/admin/age-groups',       label: 'Age Groups',       icon: '🎯', superOnly: true  },
  { path: '/admin/levels',           label: 'Levels',           icon: '📶', superOnly: true  },
  { path: '/admin/admin-users',      label: 'Admin Users',      icon: '👑', superOnly: true  },
  // ── Shared section ──
  { path: '/admin/registrations',    label: 'Registrations',    icon: '📋', superOnly: false },
  { path: '/admin/payment-students', label: 'Payment Students', icon: '💳', superOnly: false },
  { path: '/admin/coaches',          label: 'Coaches',          icon: '🧑‍🏫', superOnly: false },
  { path: '/admin/reports',          label: 'Reports',          icon: '📊', superOnly: false },
  { path: '/admin/coupons',          label: 'Coupons',          icon: '🎟️', superOnly: false },
  { path: '/admin/content',          label: 'Content',          icon: '📝', superOnly: false },
  { path: '/admin/messages',         label: 'Messages',         icon: '💬', superOnly: false },
];

export default function AdminLayout() {
  const { user, logout, isSuperAdmin } = useAdminAuth();
  const navigate  = useNavigate();
  const [sideOpen, setSideOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const visibleNav = NAV_ITEMS.filter(item => !item.superOnly || isSuperAdmin);

  return (
    <div style={styles.shell}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{ ...styles.sidebar, transform: sideOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        {/* Brand */}
        <div style={styles.sideHeader}>
          <div style={styles.logoMark}>CCA</div>
          <div>
            <div style={styles.sideTitle}>Admin Portal</div>
            <div style={styles.sideRole}>
              {isSuperAdmin ? '⭐ Super Admin' : '🔧 Admin'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {isSuperAdmin && (
            <div style={styles.navGroup}>SUPER ADMIN</div>
          )}
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info at bottom */}
        <div style={styles.sideFooter}>
          <div style={styles.userBadge}>
            <div style={styles.avatar}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div style={styles.userName}>{user?.firstName} {user?.lastName}</div>
              <div style={styles.userEmail}>{user?.username}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────── */}
      <div style={styles.main}>
        {/* Top header */}
        <header style={styles.header}>
          <button
            onClick={() => setSideOpen(!sideOpen)}
            style={styles.menuBtn}
            title="Toggle sidebar"
          >
            ☰
          </button>
          <div style={styles.headerRight}>
            <span style={styles.headerRole}>
              {isSuperAdmin ? '⭐ Super Admin' : '🔧 Admin'}
            </span>
            <span style={styles.headerUser}>{user?.firstName}</span>
          </div>
        </header>

        {/* Page content */}
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─── Styles (dark green + gold palette) ──────────────────────────────────────
const styles = {
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0d1b0e',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    background: 'linear-gradient(180deg, #0a2416 0%, #0d1b0e 100%)',
    borderRight: '1px solid rgba(212,175,55,0.15)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease',
    zIndex: 100,
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
},
  sideHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '24px 20px',
    borderBottom: '1px solid rgba(212,175,55,0.15)',
  },
  logoMark: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #D4AF37, #F5D97A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0a2416',
    fontWeight: '800',
    fontSize: '14px',
    letterSpacing: '1px',
    flexShrink: 0,
  },
  sideTitle: {
    color: '#F5D97A',
    fontSize: '15px',
    fontWeight: '700',
  },
  sideRole: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '11px',
    marginTop: '2px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
  },
  navGroup: {
    color: 'rgba(212,175,55,0.5)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '1px',
    padding: '8px 8px 4px',
    marginTop: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.65)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.15s',
  },
  navActive: {
    background: 'rgba(212,175,55,0.15)',
    color: '#F5D97A',
    borderLeft: '3px solid #D4AF37',
  },
  navIcon: {
    fontSize: '16px',
    width: '20px',
    textAlign: 'center',
  },
  sideFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(212,175,55,0.15)',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(212,175,55,0.2)',
    border: '1px solid rgba(212,175,55,0.3)',
    color: '#F5D97A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0,
  },
  userName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px',
    fontWeight: '600',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '6px',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  header: {
    height: '60px',
    background: 'rgba(10,36,22,0.95)',
    borderBottom: '1px solid rgba(212,175,55,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRole: {
    background: 'rgba(212,175,55,0.1)',
    border: '1px solid rgba(212,175,55,0.2)',
    color: '#F5D97A',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
  },
  headerUser: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
  },
  content: {
    flex: 1,
    padding: '28px',
    overflowY: 'auto',
  },
};

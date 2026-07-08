// ============================================================
//  components/BottomNav.js — Mobile-style bottom tab bar
// ============================================================
import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { path: '/coach/dashboard', label: 'Dashboard',   icon: '🏠' },
  { path: '/coach/batches',   label: 'Batches',     icon: '📋' },
  { path: '/coach/scan',      label: 'Attendance',  icon: '📝' },
  { path: '/coach/students',  label: 'Students',    icon: '🧒' },
  { path: '/coach/messages',  label: 'Messages',    icon: '💬' },
  { path: '/coach/profile',   label: 'Profile',     icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#ffffff', borderTop: '1px solid #e2e8f0',
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 4px calc(8px + env(safe-area-inset-bottom))',
      zIndex: 50,
    }}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '2px', textDecoration: 'none',
            color: isActive ? '#2563eb' : '#94a3b8',
            fontSize: '11px', fontWeight: 600, flex: 1,
          })}
        >
          <span style={{ fontSize: '20px' }}>{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
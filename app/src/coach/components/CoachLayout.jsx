// ============================================================
//  components/CoachLayout.js — Shell with top bar + bottom nav
// ============================================================
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useCoachAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import { Avatar } from './UI';

export default function CoachLayout() {
  const { coach } = useCoachAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#0d1b0e', paddingBottom: '76px' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', background: '#0a2416', borderBottom: '1px solid rgba(212,175,55,0.15)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px' }}>CCA COACH PORTAL</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
            Hi, {coach?.firstName || 'Coach'} 👋
          </div>
        </div>
        <Avatar photoUrl={coach?.photoUrl} firstName={coach?.firstName} lastName={coach?.lastName} size={38} />
      </header>

      <main style={{ padding: '18px', maxWidth: '560px', margin: '0 auto' }}>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}

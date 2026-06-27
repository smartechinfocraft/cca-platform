// ============================================================
//  components/UI.js — Shared UI primitives for Coach Portal
//  Mobile-first, dark green + gold theme (matches Admin Portal)
// ============================================================
import React from 'react';

export const Card = ({ children, style }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212,175,55,0.18)',
    borderRadius: '14px',
    padding: '18px',
    ...style,
  }}>
    {children}
  </div>
);

export const Btn = ({ children, onClick, variant = 'primary', disabled, type = 'button', full, style }) => {
  const variants = {
    primary: { background: 'linear-gradient(135deg,#D4AF37,#F5D97A)', color: '#0a2416', border: 'none' },
    ghost:   { background: 'transparent', color: '#F5D97A', border: '1px solid rgba(212,175,55,0.4)' },
    danger:  { background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' },
    dark:    { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        padding: '12px 20px',
        borderRadius: '10px',
        fontWeight: 700,
        fontSize: '14px',
        width: full ? '100%' : 'auto',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform 0.1s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Input = (props) => (
  <input
    {...props}
    style={{
      width: '100%',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(212,175,55,0.25)',
      borderRadius: '10px',
      padding: '12px 14px',
      color: '#fff',
      fontSize: '15px',
      outline: 'none',
      ...props.style,
    }}
  />
);

export const FormField = ({ label, children, required }) => (
  <div style={{ marginBottom: '16px' }}>
    {label && (
      <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
        {label}{required && <span style={{ color: '#F5D97A' }}> *</span>}
      </label>
    )}
    {children}
  </div>
);

export const Badge = ({ label, tone }) => {
  const tones = {
    success: { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' },
    warning: { bg: 'rgba(234,179,8,0.15)', fg: '#facc15' },
    danger:  { bg: 'rgba(220,38,38,0.15)', fg: '#fca5a5' },
    neutral: { bg: 'rgba(255,255,255,0.08)', fg: '#cbd5e1' },
  };
  const t = tones[tone] || (label === 'ACTIVE' || label === 'PRESENT' ? tones.success
    : label === 'INACTIVE' || label === 'ABSENT' ? tones.danger
    : tones.neutral);
  return (
    <span style={{
      display: 'inline-block', background: t.bg, color: t.fg,
      fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
    }}>
      {label}
    </span>
  );
};

export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '12px' }}>
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon = '📭', text }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
    <div style={{ fontSize: '36px', marginBottom: '8px' }}>{icon}</div>
    <div style={{ fontSize: '14px' }}>{text}</div>
  </div>
);

export const Spinner = () => (
  <div style={{ textAlign: 'center', padding: '40px', color: '#D4AF37', fontSize: '14px' }}>
    Loading...
  </div>
);

export const Avatar = ({ photoUrl, firstName, lastName, size = 44 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#F5D97A', fontWeight: 700, fontSize: size * 0.36,
    overflow: 'hidden', flexShrink: 0,
  }}>
    {photoUrl
      ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : `${firstName?.[0] || ''}${lastName?.[0] || ''}`
    }
  </div>
);

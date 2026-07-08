// ============================================================
//  components/UI.js — Shared UI primitives for Coach Portal
//  Light, clean theme (blue accent — no green anywhere)
// ============================================================
import React from 'react';

// ── Shared color tokens ─────────────────────────────────────
export const colors = {
  bg:          '#f1f5f9',
  card:        '#ffffff',
  border:      '#e2e8f0',
  text:        '#0f172a',
  textSoft:    '#475569',
  textMuted:   '#94a3b8',
  accent:      '#2563eb',
  accentSoft:  'rgba(37,99,235,0.08)',
  accentLight: '#3b82f6',
  danger:      '#dc2626',
  dangerSoft:  'rgba(220,38,38,0.08)',
  amber:       '#b45309',
  amberSoft:   'rgba(217,119,6,0.12)',
};

export const Card = ({ children, style }) => (
  <div style={{
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '14px',
    padding: '18px',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    ...style,
  }}>
    {children}
  </div>
);

export const Btn = ({ children, onClick, variant = 'primary', disabled, type = 'button', full, style }) => {
  const variants = {
    primary: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: colors.accent, border: `1px solid rgba(37,99,235,0.4)` },
    danger:  { background: colors.dangerSoft, color: colors.danger, border: '1px solid rgba(220,38,38,0.35)' },
    dark:    { background: '#f1f5f9', color: colors.text, border: `1px solid ${colors.border}` },
    success: { background: '#eff6ff', color: colors.accent, border: '1px solid rgba(37,99,235,0.35)' },
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
        opacity: disabled ? 0.55 : 1,
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
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      color: colors.text,
      fontSize: '15px',
      outline: 'none',
      ...props.style,
    }}
  />
);

export const Select = (props) => (
  <select
    {...props}
    style={{
      width: '100%',
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      color: colors.text,
      fontSize: '14.5px',
      outline: 'none',
      ...props.style,
    }}
  >
    {props.children}
  </select>
);

export const FormField = ({ label, children, required }) => (
  <div style={{ marginBottom: '16px' }}>
    {label && (
      <label style={{ display: 'block', fontSize: '13px', color: colors.textSoft, marginBottom: '6px', fontWeight: 600 }}>
        {label}{required && <span style={{ color: colors.accent }}> *</span>}
      </label>
    )}
    {children}
  </div>
);

export const Badge = ({ label, tone }) => {
  const tones = {
    success: { bg: colors.accentSoft, fg: colors.accent },
    warning: { bg: colors.amberSoft, fg: colors.amber },
    danger:  { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: '#f1f5f9', fg: colors.textSoft },
  };
  const t = tones[tone] || (
    label === 'ACTIVE' || label === 'PRESENT' ? tones.success
    : label === 'INACTIVE' || label === 'ABSENT' ? tones.danger
    : label === 'LATE' || label === 'EXCUSED' ? tones.warning
    : tones.neutral
  );
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
      <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: colors.text }}>{title}</h1>
      {subtitle && <p style={{ fontSize: '13px', color: colors.textMuted, margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon = '📭', text }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textMuted }}>
    <div style={{ fontSize: '36px', marginBottom: '8px' }}>{icon}</div>
    <div style={{ fontSize: '14px' }}>{text}</div>
  </div>
);

export const Spinner = () => (
  <div style={{ textAlign: 'center', padding: '40px', color: colors.accent, fontSize: '14px' }}>
    Loading...
  </div>
);

export const Avatar = ({ photoUrl, firstName, lastName, size = 44 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: colors.accent, fontWeight: 700, fontSize: size * 0.36,
    overflow: 'hidden', flexShrink: 0,
  }}>
    {photoUrl
      ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : `${firstName?.[0] || ''}${lastName?.[0] || ''}`
    }
  </div>
);
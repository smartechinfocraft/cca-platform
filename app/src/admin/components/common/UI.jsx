// ============================================================
//  components/common/UI.js
//  Reusable: PageHeader, DataTable, Modal, FormField, Button
//  Import these in every page to keep the UI consistent
// ============================================================
import React from 'react';

// ─── PageHeader ───────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
    <div>
      <h1 style={{ color: '#F5D97A', fontSize: '22px', fontWeight: '700', margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ─── Button ───────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = 'primary', disabled, type = 'button', small }) => {
  const base = {
    border: 'none',
    borderRadius: '8px',
    padding: small ? '6px 14px' : '10px 20px',
    fontSize: small ? '12px' : '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#0a2416' },
    danger:  { background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' },
    ghost:   { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' },
    success: { background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
};

// ─── DataTable ────────────────────────────────────────────────────────────────
// columns: [{ key, label, render? }]  rows: array of objects
export const DataTable = ({ columns, rows, loading, emptyMsg = 'No data found' }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '12px', overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={thStyle}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} style={emptyTd}>Loading...</td></tr>
          ) : !rows?.length ? (
            <tr><td colSpan={columns.length} style={emptyTd}>{emptyMsg}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row._id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {columns.map(col => (
                  <td key={col.key} style={tdStyle}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const thStyle = {
  textAlign: 'left', padding: '12px 16px',
  color: 'rgba(255,255,255,0.4)', fontSize: '12px',
  fontWeight: '500', letterSpacing: '0.5px',
  background: 'rgba(255,255,255,0.02)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const tdStyle = { padding: '12px 16px', color: 'rgba(255,255,255,0.75)', verticalAlign: 'middle' };
const emptyTd = { ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px', width: '100%' };

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, width = '520px' }) => {
  if (!open) return null;
  return (
    <div style={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyles.box, maxWidth: width }}>
        <div style={modalStyles.header}>
          <span style={modalStyles.title}>{title}</span>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>
        <div style={modalStyles.body}>{children}</div>
      </div>
    </div>
  );
};

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  box: {
    background: '#0f3d22', border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '16px', width: '100%', maxHeight: '90vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid rgba(212,175,55,0.15)',
  },
  title: { color: '#F5D97A', fontSize: '16px', fontWeight: '700' },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
    fontSize: '18px', cursor: 'pointer', padding: '0 4px',
  },
  body: { padding: '24px', overflowY: 'auto' },
};

// ─── FormField ────────────────────────────────────────────────────────────────
export const FormField = ({ label, error, children, required }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
      {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    {children}
    {error && <div style={{ color: '#fca5a5', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
  </div>
);

// ─── Input / Select / Textarea ────────────────────────────────────────────────
export const Input = ({ ...props }) => (
  <input {...props} style={{
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '8px', padding: '10px 14px',
    color: '#fff', fontSize: '14px', outline: 'none',
    ...(props.style || {}),
  }} />
);

export const Select = ({ children, ...props }) => (
  <select {...props} style={{
    width: '100%', boxSizing: 'border-box',
    background: '#0f3d22', border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '8px', padding: '10px 14px',
    color: '#fff', fontSize: '14px', outline: 'none',
    ...(props.style || {}),
  }}>
    {children}
  </select>
);

export const Textarea = ({ ...props }) => (
  <textarea {...props} style={{
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '8px', padding: '10px 14px',
    color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '80px',
    ...(props.style || {}),
  }} />
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  CONFIRMED:'#22c55e', PAID:'#3b82f6', PENDING:'#A33B2B', ACTIVE:'#22c55e',
  CANCELLED:'#ef4444', REFUNDED:'#8b5cf6', INACTIVE:'#6b7280',
  WAITLISTED:'#6b7280', AWAITING_PAYMENT:'#eab308', SUPER_ADMIN:'#D4AF37',
};

export const Badge = ({ label }) => {
  const color = STATUS_COLORS[label] || '#6b7280';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      background: color + '22', color, border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
};

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export const Card = ({ children, style }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(212,175,55,0.12)',
    borderRadius: '12px', padding: '24px',
    ...style,
  }}>
    {children}
  </div>
);

// ─── Search input ─────────────────────────────────────────────────────────────
export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div style={{ position: 'relative' }}>
    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>🔍</span>
    <Input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ paddingLeft: '36px', width: '260px' }}
    />
  </div>
);

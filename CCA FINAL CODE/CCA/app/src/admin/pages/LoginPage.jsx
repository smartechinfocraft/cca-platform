// ============================================================
//  pages/LoginPage.js
//  Admin login form — dark green/gold design inspired by calcricket.org
// ============================================================
import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAdminAuth }          from '../context/AuthContext';
import toast                from 'react-hot-toast';

export default function LoginPage() {
  const { login }          = useAdminAuth();
  const navigate           = useNavigate();
  const [form, setForm]    = useState({ username: '', password: '' });
  const [loading, setLoad] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoad(true);
    try {
      const user = await login(form.username, form.password);
      toast.success(`Welcome back, ${user.firstName}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setLoad(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Background texture */}
      <div style={styles.bgOverlay} />

      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logoCircle}>
            <span style={styles.logoText}>CCA</span>
          </div>
          <h1 style={styles.title}>Admin Portal</h1>
          <p style={styles.subtitle}>California Cricket Academy</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username or Email</label>
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="superadminwork.01"
              style={styles.input}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                style={styles.input}
                autoComplete="current-password"
              />
              {/* Show/hide password toggle */}
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={styles.eyeBtn}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>
          Secured access — CCA staff only
        </p>
      </div>
    </div>
  );
}

// ─── Inline styles (golf club dark green + gold palette) ──────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #FDF6F0 0%, #2D1B1B 50%, #FDF6F0 100%)',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(243, 221, 253, 0.95)',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 24px 64px rgba(226, 37, 37, 0.1)s',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 1,
  },
  brand: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  logoCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #B76E79, #9C5460)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 4px 20px rgba(183,110,121,0.4)',
  },
  logoText: {
    color: '#FDF6F0',
    fontWeight: '800',
    fontSize: '22px',
    letterSpacing: '1px',
  },
  title: {
    color: '#9C5460',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 4px',
    letterSpacing: '0.5px',
  },
  subtitle: {
    color: 'rgba(45,27,27,0.5)',
    fontSize: '13px',
    margin: 0,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: 'rgba(45,27,27,0.7)',
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.3px',
  },
  input: {
    background: 'rgba(45,27,27,0.06)',
    border: '1px solid rgba(183,110,121,0.2)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#2D1B1B',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0',
  },
  btn: {
    background: 'linear-gradient(135deg, #B76E79, #7A3D48)',
    color: '#FDF6F0',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '4px',
    letterSpacing: '0.5px',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '12px',
    marginTop: '24px',
    marginBottom: 0,
    letterSpacing: '0.3px',
  },
};

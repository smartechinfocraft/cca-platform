// ============================================================
//  pages/Login.js — Coach Portal login + Forgot Password
// ============================================================
import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useCoachAuth } from '../context/AuthContext';
import { Btn, Input, FormField, Card } from '../components/UI';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Login() {
  const { login, coach, loading } = useCoachAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot]    = useState(false);
  const [forgotEmail, setForgotEmail]  = useState('');
  const [forgotLoading, setForgotLoad] = useState(false);
  const [forgotSent, setForgotSent]    = useState(false);

  if (!loading && coach) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Enter your username and password');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      toast.success('Welcome back!');
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your username and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error('Please enter your email'); return; }
    setForgotLoad(true);
    try {
      await axios.post(`${API_BASE}/coach-auth/forgot-password`, { email: forgotEmail });
    } catch {
      // Silent — always show success for security
    } finally {
      setForgotLoad(false);
      setForgotSent(true);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotSent(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 0%, #133a20 0%, #0d1b0e 60%)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#D4AF37,#F5D97A)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '20px', color: '#0a2416',
          }}>
            CCA
          </div>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: '0 0 4px', fontWeight: 800 }}>Coach Portal</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>California Cricket Academy</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <FormField label="Username or Coach ID" required>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ravi.sharma"
                autoComplete="username"
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </FormField>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none', color: '#D4AF37',
                  fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>

            <Btn type="submit" full disabled={submitting} style={{ marginTop: '6px' }}>
              {submitting ? 'Logging in...' : 'Log In'}
            </Btn>
          </form>
        </Card>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '18px' }}>
          Don't have your login details? Contact your academy admin —
          your username and password were emailed to you when your profile was created.
        </p>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '24px',
          }}
          onClick={closeForgot}
        >
          <div
            style={{
              background: '#1a2e1e', border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '380px',
              position: 'relative', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeForgot}
              style={{
                position: 'absolute', top: '14px', right: '16px',
                background: 'none', border: 'none', color: '#94a3b8',
                fontSize: '18px', cursor: 'pointer',
              }}
            >✕</button>

            {forgotSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✉️</div>
                <h2 style={{ color: '#D4AF37', fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }}>Check Your Email</h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
                  If <strong style={{ color: '#fff' }}>{forgotEmail}</strong> is registered, we've sent a temporary password there.
                  Use it to log in, then update your password.
                </p>
                <Btn full onClick={closeForgot}>Back to Login</Btn>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '8px' }}>🔑</div>
                <h2 style={{ color: '#D4AF37', fontSize: '18px', fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>
                  Reset Password
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '0 0 20px', lineHeight: '1.5' }}>
                  Enter the email address associated with your coach account.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <FormField label="Registered Email" required>
                    <Input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="coach@calcricket.org"
                      autoFocus
                    />
                  </FormField>
                  <Btn type="submit" full disabled={forgotLoading} style={{ marginTop: '8px' }}>
                    {forgotLoading ? 'Sending...' : 'Send Temporary Password'}
                  </Btn>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

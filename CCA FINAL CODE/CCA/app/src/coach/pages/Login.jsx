// ============================================================
//  pages/Login.js — Coach Portal login
// ============================================================
import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useCoachAuth } from '../context/AuthContext';
import { Btn, Input, FormField, Card } from '../components/UI';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, coach, loading } = useCoachAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    </div>
  );
}

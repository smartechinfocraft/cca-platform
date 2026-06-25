// ============================================================
//  context/AuthContext.js
//  Global auth state: current user, login, logout
//  Wrap your app in <AuthProvider> then use useAuth() anywhere
// ============================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';

// Create the context
const AuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  // Initialize user from localStorage so the page doesn't flash login on refresh
  const [user, setUser]       = useState(() => {
    const stored = localStorage.getItem('cca_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // On app load: verify the stored token is still valid
  useEffect(() => {
    const token = localStorage.getItem('cca_token');
    if (token) {
      authAPI.getMe()
        .then(res => {
          setUser(res.data.user);
          localStorage.setItem('cca_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          // Token invalid — clean up
          localStorage.removeItem('cca_token');
          localStorage.removeItem('cca_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login({ username, password });
    const { token, user: userData } = res.data;

    // Persist token and user so they survive page refresh
    localStorage.setItem('cca_token', token);
    localStorage.setItem('cca_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('cca_token');
    localStorage.removeItem('cca_user');
    setUser(null);
  };

  // isSuperAdmin — used to show/hide super-admin-only features in the UI
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access
export const useAdminAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};

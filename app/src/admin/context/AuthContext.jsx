// ============================================================
//  context/AuthContext.js
//  Global auth state: current user, login, logout
//  Wrap your app in <AuthProvider> then use useAuth() anywhere
//  SECURITY: access token lives in memory only (api/client.jsx);
//  the refresh token lives in an HttpOnly cookie set by the server.
// ============================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setAccessToken, refreshAccessToken } from '../api/client';

// Create the context
const AuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  // We keep a cached, non-sensitive copy of the user object (no token) in
  // localStorage purely so the UI doesn't flash "logged out" for a split
  // second before the silent refresh below resolves.
  const [user, setUser]       = useState(() => {
    const stored = localStorage.getItem('cca_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // On app load: exchange the HttpOnly refresh cookie (if any) for a new
  // access token, then confirm it against /auth/me.
  useEffect(() => {
    (async () => {
      const result = await refreshAccessToken();
      if (result?.token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data.user);
          localStorage.setItem('cca_user', JSON.stringify(res.data.user));
        } catch {
          setAccessToken(null);
          localStorage.removeItem('cca_user');
          setUser(null);
        }
      } else {
        localStorage.removeItem('cca_user');
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login({ username, password });
    const { token, user: userData } = res.data;

    // Access token stays in memory only; only the (non-sensitive) user
    // object is cached in localStorage for the anti-flash behavior above.
    setAccessToken(token);
    localStorage.setItem('cca_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = () => {
    // Fire-and-forget: revokes the refresh token + clears the cookie
    // server-side. UI state is cleared immediately regardless.
    authAPI.logout().catch(() => {});
    setAccessToken(null);
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

// ============================================================
//  context/AuthContext.js — Coach login/session state
//  SECURITY: access token lives in memory only (api/client.jsx);
//  the refresh token lives in an HttpOnly cookie set by the server.
// ============================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { coachAuthAPI, setAccessToken, refreshAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function CoachAuthProvider({ children }) {
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await refreshAccessToken();
      if (!result?.token) {
        localStorage.removeItem('cca_coach_user');
        setLoading(false);
        return;
      }
      try {
        const res = await coachAuthAPI.getMe();
        setCoach(res.data.coach);
      } catch {
        setAccessToken(null);
        localStorage.removeItem('cca_coach_user');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    const res = await coachAuthAPI.login({ username, password });
    const { token, coach: coachData } = res.data;
    setAccessToken(token);
    localStorage.setItem('cca_coach_user', JSON.stringify(coachData));
    setCoach(coachData);
    return coachData;
  };

  const logout = () => {
    // Fire-and-forget: revokes the refresh token + clears the cookie
    // server-side. UI state is cleared immediately regardless.
    coachAuthAPI.logout().catch(() => {});
    setAccessToken(null);
    localStorage.removeItem('cca_coach_user');
    setCoach(null);
    window.location.href = '/login';
  };

  const refreshCoach = async () => {
    const res = await coachAuthAPI.getMe();
    setCoach(res.data.coach);
    return res.data.coach;
  };

  return (
    <AuthContext.Provider value={{ coach, loading, login, logout, refreshCoach }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useCoachAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useCoachAuth must be used within CoachAuthProvider');
  return ctx;
};

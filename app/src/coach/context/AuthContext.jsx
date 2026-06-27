// ============================================================
//  context/AuthContext.js — Coach login/session state
// ============================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { coachAuthAPI } from '../api/client';

const AuthContext = createContext(null);

export function CoachAuthProvider({ children }) {
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cca_coach_token');
    if (!token) { setLoading(false); return; }

    coachAuthAPI.getMe()
      .then((res) => setCoach(res.data.coach))
      .catch(() => {
        localStorage.removeItem('cca_coach_token');
        localStorage.removeItem('cca_coach_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await coachAuthAPI.login({ username, password });
    const { token, coach: coachData } = res.data;
    localStorage.setItem('cca_coach_token', token);
    localStorage.setItem('cca_coach_user', JSON.stringify(coachData));
    setCoach(coachData);
    return coachData;
  };

  const logout = () => {
    localStorage.removeItem('cca_coach_token');
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

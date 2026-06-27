// ============================================================
//  src/api/client.js — Axios instance for the Coach Portal
//  Uses a SEPARATE localStorage key from the admin app
//  (cca_coach_token / cca_coach_user) so a coach and an admin
//  could even be logged in on the same browser without clashing.
// ============================================================
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cca_coach_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cca_coach_token');
      localStorage.removeItem('cca_coach_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;

// ─── API helper functions ─────────────────────────────────────

export const coachAuthAPI = {
  login: (data) => client.post('/coach-auth/login', data),
  getMe: () => client.get('/coach-auth/me'),
};

export const coachPortalAPI = {
  getDashboard:    ()           => client.get('/coach-portal/dashboard'),
  getProfile:      ()           => client.get('/coach-portal/profile'),
  updateProfile:   (data)       => client.put('/coach-portal/profile', data),
  changePassword:  (data)       => client.put('/coach-portal/profile/password', data),
  getMyBatches:    ()           => client.get('/coach-portal/batches'),
  getBatchDetail:  (batchId)    => client.get(`/coach-portal/batches/${batchId}`),
  getMyStudents:   (params)     => client.get('/coach-portal/students', { params }),
  getStudentDetail:(studentId)  => client.get(`/coach-portal/students/${studentId}`),
  scanAttendance:  (data)       => client.post('/coach-portal/attendance/scan', data),
  getAttendance:   (params)     => client.get('/coach-portal/attendance', { params }),
  getMessages:     ()           => client.get('/coach-portal/messages'),
  replyMessage:    (threadId, body) => client.post(`/coach-portal/messages/${threadId}/reply`, { body }),
};

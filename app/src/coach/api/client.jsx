// ============================================================
//  src/api/client.js — Axios instance for the Coach Portal
//  SECURITY: the access token now lives in memory only (not
//  localStorage); the refresh token lives in an HttpOnly,
//  portal-scoped cookie (cca_coach_rt) set by the server.
// ============================================================
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send/receive the HttpOnly refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

export const refreshAccessToken = async () => {
  try {
    const res = await axios.post(`${API_BASE}/coach-auth/refresh`, {}, { withCredentials: true });
    setAccessToken(res.data.token);
    return res.data;
  } catch {
    setAccessToken(null);
    return null;
  }
};

client.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/coach-auth/refresh')
    ) {
      originalRequest._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => { refreshPromise = null; });
      const result = await refreshPromise;

      if (result?.token) {
        originalRequest.headers.Authorization = `Bearer ${result.token}`;
        return client(originalRequest);
      }

      setAccessToken(null);
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
  login:  (data) => client.post('/coach-auth/login', data),
  logout: ()     => client.post('/coach-auth/logout'),
  getMe:  ()     => client.get('/coach-auth/me'),
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

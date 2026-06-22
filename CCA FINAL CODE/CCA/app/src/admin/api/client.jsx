// ============================================================
//  src/admin/api/client.js — Axios instance for the Admin Panel
//  (ported from CRA to Vite — uses import.meta.env, not process.env)
// ============================================================
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cca_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If data is FormData, let the browser set Content-Type (with boundary)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cca_token');
      localStorage.removeItem('cca_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;

// ─── API helper functions ─────────────────────────────────────────────────────

export const authAPI = {
  login:       (data) => client.post('/auth/login', data),
  getMe:       ()     => client.get('/auth/me'),
  listAdmins:  ()     => client.get('/auth/admins'),
  createAdmin: (data) => client.post('/auth/admins', data),
  toggleStatus:(id)   => client.patch(`/auth/admins/${id}/status`),
};

export const dashboardAPI = {
  getStats: () => client.get('/dashboard/stats'),
};

// ISSUE 4 & 5: create/update accept FormData (with coverImage file)
export const programsAPI = {
  getAll:  (params)   => client.get('/programs', { params }),
  getOne:  (id)       => client.get(`/programs/${id}`),
  create:  (formData) => client.post('/programs', formData),
  update:  (id, formData) => client.put(`/programs/${id}`, formData),
  remove:  (id)       => client.delete(`/programs/${id}`),
  hardRemove: (id)    => client.delete(`/programs/${id}/permanent`),
};

export const categoriesAPI = {
  getAll:  ()         => client.get('/categories'),
  create:  (data)     => client.post('/categories', data),
  update:  (id, data) => client.put(`/categories/${id}`, data),
  remove:  (id)       => client.delete(`/categories/${id}`),
};

export const locationsAPI = {
  getAll:  ()         => client.get('/locations'),
  create:  (data)     => client.post('/locations', data),
  update:  (id, data) => client.put(`/locations/${id}`, data),
  remove:  (id)       => client.delete(`/locations/${id}`),
};

export const ageGroupsAPI = {
  getAll:  ()         => client.get('/age-groups'),
  create:  (data)     => client.post('/age-groups', data),
  update:  (id, data) => client.put(`/age-groups/${id}`, data),
  remove:  (id)       => client.delete(`/age-groups/${id}`),
};

export const levelsAPI = {
  getAll:  ()         => client.get('/levels'),
  create:  (data)     => client.post('/levels', data),
  update:  (id, data) => client.put(`/levels/${id}`, data),
  remove:  (id)       => client.delete(`/levels/${id}`),
};

export const batchesAPI = {
  getAll:  (params)   => client.get('/batches', { params }),
  getOne:  (id)       => client.get(`/batches/${id}`),
  create:  (data)     => client.post('/batches', data),
  update:  (id, data) => client.put(`/batches/${id}`, data),
  remove:  (id)       => client.delete(`/batches/${id}`),
  hardRemove: (id)    => client.delete(`/batches/${id}/permanent`),
};

export const registrationsAPI = {
  getAll:         (params) => client.get('/registrations', { params }),
  getOne:         (id)     => client.get(`/registrations/${id}`),
  updateStatus:   (id, data) => client.patch(`/registrations/${id}/status`, data),
  toggleWhatsapp: (id)     => client.patch(`/registrations/${id}/whatsapp`),
  superAdminEdit: (id, data) => client.patch(`/registrations/${id}/edit`, data),
  confirmCheck:   (id)     => client.patch(`/registrations/${id}/confirm-check`), 
};

// ISSUE 5: coaches logo is a file upload
export const coachesAPI = {
  getAll:  ()         => client.get('/coaches'),
  getOne:  (id)       => client.get(`/coaches/${id}`),
  create:  (data)     => client.post('/coaches', data),
  update:  (id, data) => client.put(`/coaches/${id}`, data),
  remove:  (id)       => client.delete(`/coaches/${id}`),
  resendCredentials: (id) => client.post(`/coaches/${id}/resend-credentials`),
};

export const couponsAPI = {
  getAll:  ()         => client.get('/coupons'),
  create:  (data)     => client.post('/coupons', data),
  update:  (id, data) => client.put(`/coupons/${id}`, data),
  remove:  (id)       => client.delete(`/coupons/${id}`),
};

export const reportsAPI = {
  getRevenue:  (params) => client.get('/reports/revenue', { params }),
  buildCustom: (data)   => client.post('/reports/custom', data),
  exportCSV:   (params) => client.get('/reports/export', { params, responseType: 'blob' }),
};

// ISSUE 5 & 7: sponsors use logoFile upload; media use coverImage + pdfFile upload
export const contentAPI = {
  getFAQs:     ()         => client.get('/content/faqs'),
  createFAQ:   (data)     => client.post('/content/faqs', data),
  updateFAQ:   (id, data) => client.put(`/content/faqs/${id}`, data),
  deleteFAQ:   (id)       => client.delete(`/content/faqs/${id}`),

  // Sponsors — logoFile is a real file (FormData)
  getSponsors:    ()           => client.get('/content/sponsors'),
  createSponsor:  (formData)   => client.post('/content/sponsors', formData),
  updateSponsor:  (id, formData) => client.put(`/content/sponsors/${id}`, formData),
  deleteSponsor:  (id)         => client.delete(`/content/sponsors/${id}`),

  // Media (Gallery/Magazine/Newsletter) — files via FormData
  getMedia:    (params)     => client.get('/content/media', { params }),
  createMedia: (formData)   => client.post('/content/media', formData),
  updateMedia: (id, formData) => client.put(`/content/media/${id}`, formData),
  deleteMedia: (id)         => client.delete(`/content/media/${id}`),
};

export const messagesAPI = {
  getAll: (params) => client.get('/messages', { params }),
  reply:  (threadId, body) => client.post(`/messages/${threadId}/reply`, { body }),
  setStatus: (threadId, status) => client.patch(`/messages/${threadId}/status`, { status }),
};

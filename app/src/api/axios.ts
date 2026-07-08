import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001/api",
  timeout: 10000,
  withCredentials: true, // send/receive the HttpOnly refresh-token cookie
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── In-memory access token ────────────────────────────────────────────────
// SECURITY: the short-lived access token now lives ONLY in memory — never
// in localStorage — so it can't be read by an XSS payload that persists
// across page loads. It's naturally cleared on tab close / refresh, at
// which point silentRefresh() (called from AuthContext on mount) restores
// it using the HttpOnly refresh-token cookie.
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Silently exchanges the HttpOnly refresh cookie for a new access token.
export const silentRefresh = async (): Promise<string | null> => {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001/api"}/public/auth/refresh`,
      {},
      { withCredentials: true }
    );
    setAccessToken(res.data.token);
    return res.data.token;
  } catch {
    setAccessToken(null);
    return null;
  }
};

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/auth/refresh")) {
      originalRequest._retry = true;
      // De-duplicate concurrent refreshes if several requests 401 at once
      refreshPromise = refreshPromise ?? silentRefresh().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      setAccessToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

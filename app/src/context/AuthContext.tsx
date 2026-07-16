// ============================================================
//  AuthContext — Parent user auth (register / login / logout)
//  SECURITY: access token lives in memory only (api/axios.ts);
//  the refresh token lives in an HttpOnly cookie set by the server.
// ============================================================
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api, { setAccessToken, silentRefresh } from "../api/axios";

interface ParentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface AuthContextValue {
  user: ParentUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  acceptSession: (token: string, parent: ParentUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<ParentUser>) => void;
  isLoggedIn: boolean;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ParentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount by exchanging the HttpOnly refresh cookie
  // (if present) for a fresh access token — replaces the old
  // "read token from localStorage" flow.
  useEffect(() => {
    (async () => {
      const newToken = await silentRefresh();
      if (newToken) {
        setToken(newToken);
        try {
          const res = await api.get("/public/auth/me");
          setUser(res.data.parent);
        } catch {
          setAccessToken(null);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post("/public/auth/login", { email, password });
      setAccessToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.parent);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const res = await api.post("/public/auth/register", data);
      setAccessToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.parent);
    } finally {
      setLoading(false);
    }
  };

  const acceptSession = (newToken: string, parent: ParentUser) => {
    setAccessToken(newToken);
    setToken(newToken);
    setUser(parent);
  };

  const logout = () => {
    // Fire-and-forget: revokes the refresh token + clears the cookie
    // server-side. UI state is cleared immediately regardless.
    api.post("/public/auth/logout").catch(() => {});
    setUser(null);
    setToken(null);
    setAccessToken(null);
  };

  // Merge a partial patch into the current parent user — used after the
  // parent edits their profile so the sidebar / header reflect changes
  // immediately without requiring a full page reload.
  const updateUser = (patch: Partial<ParentUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, acceptSession, logout, updateUser, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

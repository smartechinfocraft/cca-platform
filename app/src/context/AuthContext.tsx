// ============================================================
//  AuthContext — Parent user auth (register / login / logout)
// ============================================================
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../api/axios";

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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("cca_parent_token"));
  const [loading, setLoading] = useState(false);

  // Restore session on mount
  useEffect(() => {
    if (token) {
      api.get("/public/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data.parent))
        .catch(() => { setToken(null); localStorage.removeItem("cca_parent_token"); });
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post("/public/auth/login", { email, password });
      setToken(res.data.token);
      setUser(res.data.parent);
      localStorage.setItem("cca_parent_token", res.data.token);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const res = await api.post("/public/auth/register", data);
      setToken(res.data.token);
      setUser(res.data.parent);
      localStorage.setItem("cca_parent_token", res.data.token);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("cca_parent_token");
  };

  // Merge a partial patch into the current parent user — used after the
  // parent edits their profile so the sidebar / header reflect changes
  // immediately without requiring a full page reload.
  const updateUser = (patch: Partial<ParentUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

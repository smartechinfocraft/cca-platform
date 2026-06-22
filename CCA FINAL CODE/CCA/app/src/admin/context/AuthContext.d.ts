// Type declarations for AuthContext.js — see that file for the real
// implementation. This exists purely so .tsx files importing useAdminAuth
// get an accurate type instead of TS inferring `null` from the untyped
// createContext(null) call inside the .js file.
import type { ReactNode } from 'react';

export interface AdminUser {
  _id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  [key: string]: unknown;
}

export interface AdminAuthContextValue {
  user: AdminUser | null;
  login: (username: string, password: string) => Promise<AdminUser>;
  logout: () => void;
  loading: boolean;
  isSuperAdmin: boolean;
}

export declare function AdminAuthProvider(props: { children: ReactNode }): JSX.Element;
export declare function useAdminAuth(): AdminAuthContextValue;

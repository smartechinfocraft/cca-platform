// Type declarations for AuthContext.js — see that file for the real
// implementation. Exists so .tsx files importing useCoachAuth get an
// accurate type instead of TS inferring null.
import type { ReactNode } from 'react';

export interface CoachUser {
  _id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface CoachAuthContextValue {
  coach: CoachUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<CoachUser>;
  logout: () => void;
  refreshCoach: () => Promise<CoachUser>;
}

export declare function CoachAuthProvider(props: { children: ReactNode }): JSX.Element;
export declare function useCoachAuth(): CoachAuthContextValue;

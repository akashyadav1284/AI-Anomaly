import { useState } from 'react';

export interface UserSession {
  userId: string;
  token?: string;
  authenticatedAt: string;
  isDemo?: boolean;
}

const SESSION_STORAGE_KEY = 'iot_anomaly_guard_session';

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (sessionData: UserSession) => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch {
      // Storage unavailable fallback
    }
    setSession(sessionData);
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSession(null);
  };

  return {
    isAuthenticated: !!session,
    user: session,
    login,
    logout,
  };
}

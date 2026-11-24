import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ClassCode, UserRole } from '../shared/curriculum';

export interface CampusUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  classCode: ClassCode | null;
  trinomeNumber: number | null;
  subjectSpecialty: string | null;
}

export interface AuthStatus {
  hasAdminUser: boolean;
  hasEnvPasscode: boolean;
}

interface AuthContextValue {
  user: CampusUser | null;
  token: string | null;
  authStatus: AuthStatus;
  loadingStatus: boolean;
  refreshAuthStatus: () => Promise<void>;
  login: (email: string, password: string) => Promise<CampusUser>;
  bootstrapAdmin: (payload: { fullName: string; email: string; password: string }) => Promise<CampusUser>;
  loginWithAdminPasscode: (passcode: string) => Promise<CampusUser>;
  logout: () => void;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CampusUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    hasAdminUser: true,
    hasEnvPasscode: false,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as AuthStatus;
        setAuthStatus(data);
      }
    } catch {
      // Keep safe default
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const apiFetch = useCallback(
    (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...init, headers });
    },
    [token]
  );

  const login = useCallback(async (email: string, password: string): Promise<CampusUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Connexion impossible.');
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const bootstrapAdmin = useCallback(
    async (payload: { fullName: string; email: string; password: string }): Promise<CampusUser> => {
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation impossible.');
      setToken(data.token);
      setUser(data.user);
      await refreshAuthStatus();
      return data.user;
    },
    [refreshAuthStatus]
  );

  const loginWithAdminPasscode = useCallback(async (passcode: string): Promise<CampusUser> => {
    const res = await fetch('/api/auth/admin-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Code administrateur refusé.');
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authStatus,
        loadingStatus,
        refreshAuthStatus,
        login,
        bootstrapAdmin,
        loginWithAdminPasscode,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

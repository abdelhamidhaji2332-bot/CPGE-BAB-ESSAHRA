import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { ClassCode, UserRole } from '../shared/curriculum';
import { useLang } from './LangContext';
import { useToast } from './ToastContext';

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
  signInWithGoogle: () => Promise<CampusUser>;
  login: (email: string, password: string) => Promise<CampusUser>;
  bootstrapAdmin: (payload: { fullName: string; email: string; password: string }) => Promise<CampusUser>;
  loginWithAdminPasscode: (passcode: string) => Promise<CampusUser>;
  logout: () => Promise<void>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { t } = useLang();
  const [user, setUser] = useState<CampusUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const authModeRef = useRef<'firebase' | 'campus' | null>(null);
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

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (authModeRef.current === 'firebase') {
          authModeRef.current = null;
          setToken(null);
          setUser(null);
        }
        return;
      }

      try {
        const idToken = await fbUser.getIdToken();
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { user: CampusUser };
        authModeRef.current = 'firebase';
        setToken(idToken);
        setUser(data.user);
      } catch {
        // Ignore silent token refresh failures
      }
    });

    return () => unsubscribe();
  }, []);

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

  const signInWithGoogle = useCallback(async (): Promise<CampusUser> => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Connexion Google impossible.');
    }
    authModeRef.current = 'firebase';
    setToken(idToken);
    setUser(data.user);
    toast.success(
      t(`Bienvenue, ${data.user.fullName}.`, `مرحباً، ${data.user.fullName}.`),
      t('Connexion réussie', 'تم تسجيل الدخول')
    );
    return data.user;
  }, [t, toast]);

  const login = useCallback(
    async (email: string, password: string): Promise<CampusUser> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connexion impossible.');
      authModeRef.current = 'campus';
      setToken(data.token);
      setUser(data.user);
      toast.success(
        t(`Bienvenue, ${data.user.fullName}.`, `مرحباً، ${data.user.fullName}.`),
        t('Connexion réussie', 'تم تسجيل الدخول')
      );
      return data.user;
    },
    [t, toast]
  );

  const bootstrapAdmin = useCallback(
    async (payload: { fullName: string; email: string; password: string }): Promise<CampusUser> => {
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation impossible.');
      authModeRef.current = 'campus';
      setToken(data.token);
      setUser(data.user);
      await refreshAuthStatus();
      toast.success(
        t('Compte Équipe Dev activé avec succès.', 'تم تفعيل حساب فريق التطوير بنجاح.')
      );
      return data.user;
    },
    [refreshAuthStatus, t, toast]
  );

  const loginWithAdminPasscode = useCallback(
    async (passcode: string): Promise<CampusUser> => {
      const res = await fetch('/api/auth/admin-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code administrateur refusé.');
      authModeRef.current = 'campus';
      setToken(data.token);
      setUser(data.user);
      toast.success(t('Accès Équipe Dev accordé.', 'تم منح صلاحية فريق التطوير.'));
      return data.user;
    },
    [t, toast]
  );

  const logout = useCallback(async () => {
    authModeRef.current = null;
    setToken(null);
    setUser(null);
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // Ignore signOut errors
      }
    }
    toast.info(t('Vous avez été déconnecté(e).', 'تم تسجيل الخروج.'));
  }, [t, toast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authStatus,
        loadingStatus,
        refreshAuthStatus,
        signInWithGoogle,
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

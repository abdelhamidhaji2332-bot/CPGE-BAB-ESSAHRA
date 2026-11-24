import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Lang = 'fr' | 'ar';

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (fr: string, ar: string) => string;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem('lang') === 'ar' ? 'ar' : 'fr';
    } catch {
      return 'fr';
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('lang', lang);
    } catch {
      // Ignore storage failures
    }
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'ar' ? 'fr' : 'ar'));
  }, []);

  const t = useCallback((fr: string, ar: string) => (lang === 'ar' ? ar : fr), [lang]);

  return (
    <LangContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang doit être utilisé dans LangProvider');
  return ctx;
}

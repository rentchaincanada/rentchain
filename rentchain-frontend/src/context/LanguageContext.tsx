import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";

export type Locale = "en" | "fr";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = "rc_locale";

const dictionaries: Record<Locale, Record<string, string>> = { en, fr };

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const stored = String(window.localStorage.getItem(STORAGE_KEY) || "").trim().toLowerCase();
  return stored === "fr" ? "fr" : "en";
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key: string) => dictionaries[locale][key] || key,
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

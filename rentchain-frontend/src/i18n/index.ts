import { useEffect, useMemo, useState } from "react";

export type Locale = "en" | "fr";

const STORAGE_KEY = "rc_locale";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.about": "About",
    "nav.pricing": "Pricing",
    "nav.legal": "Legal & Help",
    "nav.login": "Log in",
    "nav.request_access": "Request access",
    "nav.dashboard": "Dashboard",
    "nav.menu": "Menu",
    "nav.open_menu": "Open menu",
    "nav.close_menu": "Close menu",
    "footer.help_center": "Help Center",
    "footer.templates": "Templates",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.about": "À propos",
    "nav.pricing": "Tarifs",
    "nav.legal": "Légal & aide",
    "nav.login": "Connexion",
    "nav.request_access": "Demander l’accès",
    "nav.dashboard": "Tableau de bord",
    "nav.menu": "Menu",
    "nav.open_menu": "Ouvrir le menu",
    "nav.close_menu": "Fermer le menu",
    "footer.help_center": "Centre d’aide",
    "footer.templates": "Modèles",
    "footer.privacy": "Confidentialité",
    "footer.terms": "Conditions",
  },
};

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const stored = String(window.localStorage.getItem(STORAGE_KEY) || "").trim().toLowerCase();
  if (stored === "en" || stored === "fr") return stored;
  const lang = String(window.navigator.language || "").toLowerCase();
  if (lang.startsWith("fr")) return "fr";
  return "en";
};

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = String(event.newValue || "").toLowerCase();
      if (next === "en" || next === "fr") {
        setLocaleState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const t = useMemo(() => {
    return (key: string) => dictionaries[locale]?.[key] || dictionaries.en[key] || key;
  }, [locale]);

  return { locale, setLocale, t };
}

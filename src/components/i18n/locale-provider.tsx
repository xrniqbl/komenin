"use client";

import * as React from "react";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
} from "@/lib/i18n/locale";
import { messages, type Locale, type Messages } from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
};

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

function writeLocaleCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(normalizeLocale(initialLocale));

  React.useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "en" || saved === "id") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      writeLocaleCookie(saved);
      return;
    }
    document.documentElement.lang = locale;
    writeLocaleCookie(locale);
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    writeLocaleCookie(normalized);
    document.documentElement.lang = normalized;
  }, []);

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      t: messages[locale] as Messages,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

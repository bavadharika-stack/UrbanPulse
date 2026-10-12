import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.json';
import ta from './ta.json';

const DICTIONARIES = { en, ta };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('urbanpulse_language') === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('urbanpulse_language', language);
    } catch {
      // Keep the selected language for this session when storage is unavailable.
    }
  }, [language]);

  const t = useCallback((key, values = {}) => {
    const translation = DICTIONARIES[language][key] || key;
    return translation.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    formatNumber: (number) => new Intl.NumberFormat(language === 'ta' ? 'ta-IN' : 'en-IN').format(number),
    formatDate: (date, options) => new Intl.DateTimeFormat(language === 'ta' ? 'ta-IN' : 'en-IN', options).format(date),
  }), [language, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}

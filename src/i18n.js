import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import th from './locales/th.json';

export const LANG_STORAGE_KEY = 'tog-lang';

const stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    th: { translation: th },
  },
  lng: stored || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});

export function switchLanguage(lng) {
  if (typeof window !== 'undefined') localStorage.setItem(LANG_STORAGE_KEY, lng);
  i18n.changeLanguage(lng);
}

export default i18n;

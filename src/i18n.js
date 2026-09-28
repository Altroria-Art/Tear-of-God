import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import th from './locales/th.json';

export const LANG_STORAGE_KEY = 'tog-lang';

let stored = null;
try { stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null; } catch { /* Storage is optional. */ }

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    th: { translation: th },
  },
  lng: stored === 'th' ? 'th' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

export function switchLanguage(lng) {
  try { if (typeof window !== 'undefined') localStorage.setItem(LANG_STORAGE_KEY, lng); } catch { /* Keep language switching functional without storage. */ }
  i18n.changeLanguage(lng);
}

export default i18n;

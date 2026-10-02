import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import thUrl from './locales/th.json?url';

export const LANG_STORAGE_KEY = 'tog-lang';

let stored = null;
try { stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null; } catch { /* Storage is optional. */ }

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

let thaiLoad;
let languageChange = 0;

async function loadThai() {
  if (i18n.hasResourceBundle('th', 'translation')) return;
  thaiLoad ??= fetch(thUrl).then((response) => {
    if (!response.ok) throw new Error('Unable to load Thai translations');
    return response.json();
  }).then((th) => {
    i18n.addResourceBundle('th', 'translation', th);
  }).catch((error) => {
    thaiLoad = null;
    throw error;
  });
  await thaiLoad;
}

export async function switchLanguage(lng) {
  const change = ++languageChange;
  try {
    if (lng === 'th') await loadThai();
    if (change !== languageChange) return;
    await i18n.changeLanguage(lng);
    try { if (typeof window !== 'undefined') localStorage.setItem(LANG_STORAGE_KEY, lng); } catch { /* Storage is optional. */ }
  } catch { /* Keep the current language when a locale cannot load. */ }
}

export async function prepareInitialLanguage() {
  if (stored === 'th') await switchLanguage('th');
}

export default i18n;

// SSR test stub replacing react-i18next: t() falls back to the given default
// (or the key) so aria-label/title literals stay greppable in the markup.
export function useTranslation() {
  return { t: (key, fallback) => fallback ?? key, i18n: { language: 'en' } };
}
export const I18nextProvider = ({ children }) => children;
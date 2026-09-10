import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h1 className="text-4xl font-bold text-ink mb-4">404</h1>
      <h2 className="text-xl text-muted mb-8">{t('common.pageNotFound', 'Page not found')}</h2>
      <Link 
        to="/" 
        className="px-6 py-2 bg-canvas border border-ink/10 rounded-md text-ink hover:bg-ink/5 transition-colors"
      >
        {t('common.backToHome', 'Back to home')}
      </Link>
    </div>
  );
}

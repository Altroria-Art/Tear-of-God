import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="flex flex-col items-center justify-center min-h-[60dvh] text-center px-4 py-12">
      <span className="sticker">{t('play.missingBadge')}</span>
      <h1 className="play-title">{t('play.missingTitle')}</h1>
      <h2 className="text-xl text-muted mb-8">{t('common.pageNotFound', 'Page not found')}</h2>
      <Link 
        to="/" 
        className="play-button"
      >
        {t('common.backHome')}
      </Link>
    </main>
  );
}

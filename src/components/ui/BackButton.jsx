import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function BackButton({ fallback = '/', children, className }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goBack = () => {
    // React Router's index counts entries within this app, unlike history.length.
    if (Number(window.history.state?.idx) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return <button type="button" onClick={goBack} aria-label={t('common.back')} className={className}>{children}</button>;
}

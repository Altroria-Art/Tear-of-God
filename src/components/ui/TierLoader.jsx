import { useTranslation } from 'react-i18next';

export default function TierLoader() {
  const { t } = useTranslation();
  return <div role="status" className="tier-loader">
    <div aria-hidden="true" className="tier-loader-bars"><i /><i /><i /></div>
    <span className="text-sm font-semibold text-muted">{t('common.loading')}</span>
  </div>;
}

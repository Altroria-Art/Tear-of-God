import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Public entry to the editor; authentication happens when publishing. */
export default function TopicRankActions({ templateId, className = '', showCommunity = true }) {
  const { t } = useTranslation();
  if (!templateId) return null;
  const id = encodeURIComponent(templateId);
  return (
    <div className={`topic-rank-actions flex flex-wrap gap-3 ${className}`}>
      <Link to={`/rank?template=${id}`} className="play-button">{t('template.use')}</Link>
      {showCommunity && <Link to={`/template/${id}/community`} className="opinion-secondary">{t('template.viewCommunityAverage')}</Link>}
    </div>
  );
}

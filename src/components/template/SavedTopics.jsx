import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBookmarks } from '../../context/BookmarkContext';
import { fetchTemplates } from '../../lib/api';
import Pagination from '../ui/Pagination';
import TemplateCard from './TemplateCard';

export default function SavedTopics({ userId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addSavedIds } = useBookmarks();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchTemplates({ saved: true, page, limit: 12 }).then(result => {
      if (cancelled) return;
      const lastPage = Math.max(1, Math.ceil((result.total || 0) / 12));
      if (!result.error && page > lastPage) {
        setPage(lastPage);
        return;
      }
      setTemplates(result.data || []);
      setTotal(result.total || 0);
      setError(result.error || '');
      if (result.data?.length) addSavedIds(result.data.map(template => template.id));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, page, retry, addSavedIds]);

  useEffect(() => {
    const update = event => {
      if (!event.detail?.id || (event.detail.userId && event.detail.userId !== userId)) return;
      if (!event.detail.saved) {
        setTemplates(previous => previous.filter(template => String(template.id) !== String(event.detail.id)));
      }
      setRetry(value => value + 1);
    };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [userId]);

  if (loading) return <p role="status" className="py-12 text-center text-sm text-muted">{t('common.loading')}</p>;
  if (error) return <div role="alert" className="py-8 text-center"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 font-bold text-brand">{t('common.retry')}</button></div>;
  if (!templates.length) return <div className="py-8 text-center text-sm text-muted"><p className="font-bold text-ink">{t('discover.noSaved')}</p><p className="mt-2">{t('discover.savedEmptyHelp')}</p><Link to="/discover/templates" className="opinion-secondary inline-flex mt-4">{t('discover.savedEmptyCta')}</Link></div>;

  return <div className="space-y-4">
    <p className="text-sm text-muted">{t('discover.savedCount', { count: total })}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map(template => <TemplateCard compact key={template.id} template={template} inSavedView onUse={item => navigate(`/rank?template=${encodeURIComponent(item.id)}`)} />)}
    </div>
    {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onChange={setPage} />}
  </div>;
}

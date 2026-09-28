import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplates } from '../lib/api';
import { loginPath } from '../lib/navigation';
import { useToast } from '../components/ui/Toast';
import TemplateCard from '../components/template/TemplateCard';
import Pagination from '../components/ui/Pagination';
import SortDropdown from '../components/ui/SortDropdown';
import { ArrowLeftIcon } from '../components/ui/Icons';
import TopicFollowButton from '../components/topic/TopicFollowButton';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: 'popular', labelKey: 'sort.popular' },
  { value: 'recent', labelKey: 'sort.recent' },
  { value: 'views', labelKey: 'sort.mostViewed' },
];

export default function HashtagDetail() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortOptions = SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'popular';

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true);
      setLoadError('');
      const { data, total, error } = await fetchTemplates({ hashtag: tag, page, limit: PAGE_SIZE, sort });
      if (cancelled) return;
      setLoadError(error || '');
      setTemplates(data || []);
      setTotal(total || 0);
      setIsLoading(false);
    }
    if (tag) load();
    return () => { cancelled = true }
  }, [tag, page, sort, retry]);

  const handleUseTemplate = (template) => {
    const next = `/rank?template=${encodeURIComponent(template.id)}`;
    if (!currentUser) {
      toast.warning(t('discover.protectedLogin'));
      navigate(loginPath(next));
      return;
    }
    navigate(next);
  };

  const setPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const handleSortChange = (nextSort) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', nextSort);
    next.set('page', '1');
    setSearchParams(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="text-ink font-sans min-h-screen flex flex-col">
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/discover/hashtags"
              className="rounded-full border border-line-soft p-2 text-ink-soft transition-colors hover:bg-surface-glass"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <span className="max-w-full break-words bg-highlight text-canvas font-bold px-4 py-1.5 rounded-full">#{tag}</span>
            <p className="text-sm text-muted">{total.toLocaleString()} {t('common.templates')}</p>
            <TopicFollowButton topicType="hashtag" topicKey={tag} />
          </div>
          <SortDropdown value={sort} options={sortOptions} onChange={handleSortChange} label={t('discover.sort')} />
        </div>

        {loadError ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-status-error">{loadError}</p>
            <button type="button" className="mt-4 rounded-xl bg-brand px-4 py-2 text-canvas" onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</button>
          </div>
        ) : isLoading ? (
          <p className="text-muted animate-pulse text-center py-10">{t('discover.loadingTemplates')}</p>
        ) : templates.length === 0 ? (
          <p className="text-muted text-center py-10">{t('discover.emptyTag')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  );
}






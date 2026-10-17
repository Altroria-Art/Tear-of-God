import BackButton from '../components/ui/BackButton';
import TierLoader from '../components/ui/TierLoader';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Flame, Clock, Eye } from 'lucide-react';
import { fetchTemplates, fetchDiscoverBoards } from '../lib/api';
import TemplateExpandedCard from '../components/template/TemplateExpandedCard';
import Pagination from '../components/ui/Pagination';
import { ArrowLeftIcon } from '../components/ui/Icons';
import TopicFollowButton from '../components/topic/TopicFollowButton';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 3;
const SORT_OPTIONS = [
  { value: 'popular', labelKey: 'sort.popular', Icon: Flame },
  { value: 'recent', labelKey: 'sort.recent', Icon: Clock },
  { value: 'views', labelKey: 'sort.mostViewed', Icon: Eye },
];

async function hydrateBoards(topics, signal) {
  if (!topics?.length) return topics || [];
  try {
    const result = await fetchDiscoverBoards(topics.map((t) => t.id), { signal });
    if (result.error || !result.data) return topics;
    const boards = new Map(result.data.map((b) => [b.template.id, b]));
    return topics.map((t) => {
      const board = boards.get(t.id);
      return board ? { ...t, board } : t;
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return topics;
  }
}

export default function HashtagDetail() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'popular';

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setIsLoading(true);
      setLoadError('');
      const { data, total: totalCount, error } = await fetchTemplates({
        hashtag: tag,
        page,
        limit: PAGE_SIZE,
        sort,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (error) {
        setLoadError(error || '');
        setTemplates([]);
        setTotal(0);
      } else {
        const enriched = await hydrateBoards(data || [], controller.signal);
        if (controller.signal.aborted) return;
        setTemplates(enriched);
        setTotal(totalCount || 0);
      }
      setIsLoading(false);
    }
    if (tag) {
      load().catch((err) => {
        if (!controller.signal.aborted) {
          setLoadError(err.message);
          setIsLoading(false);
        }
      });
    }
    return () => controller.abort();
  }, [tag, page, sort, retry]);

  const handleUseTemplate = (template) => {
    const next = `/rank?template=${encodeURIComponent(template.id)}`;
    navigate(next);
  };

  const setPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    document.getElementById('hashtag-topics')?.scrollIntoView({ behavior: 'smooth' });
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
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div id="hashtag-topics" className="mb-8 flex flex-wrap items-center justify-between gap-4 scroll-mt-20">
          <div className="flex flex-wrap items-center gap-4">
            <BackButton fallback="/discover/hashtags"
              className="rounded-full border border-line-soft p-2 text-ink-soft transition-colors hover:bg-surface-glass"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </BackButton>
            <h1 className="max-w-full break-words bg-highlight text-canvas font-bold px-4 py-1.5 rounded-full">#{tag}</h1>
            <p className="text-sm text-muted">
              {total.toLocaleString()} {t('common.templates')}
              {totalPages > 1 && (
                <span className="ml-1 text-ink-soft font-medium">
                  ({t('common.page')} {page}/{totalPages})
                </span>
              )}
            </p>
            <TopicFollowButton topicType="hashtag" topicKey={tag} />
          </div>
          <div className="flex items-center rounded-full bg-surface border border-line-soft p-1 shadow-xs" role="group" aria-label={t('discover.sort')}>
            {SORT_OPTIONS.map(({ value, labelKey, Icon }) => {
              const active = sort === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSortChange(value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-ink text-surface shadow-xs'
                      : 'text-muted hover:text-ink hover:bg-surface-glass'
                  }`}
                >
                  <Icon size={13} className={active ? 'text-highlight' : ''} />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loadError ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-status-error">{loadError}</p>
            <button type="button" className="mt-4 rounded-xl bg-brand px-4 py-2 text-canvas" onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</button>
          </div>
        ) : isLoading ? (
          <TierLoader />
        ) : templates.length === 0 ? (
          <p className="text-muted text-center py-10">{t('discover.emptyTag')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {templates.map((template) => (
              <TemplateExpandedCard key={template.id} template={template} onUse={handleUseTemplate} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  );
}






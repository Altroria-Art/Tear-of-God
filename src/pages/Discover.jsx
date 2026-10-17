import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, X, ChevronDown, CircleHelp, Flame, Clock, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { useBookmarks } from '../context/BookmarkContext';
import { fetchTemplates, fetchHashtags, fetchDiscoverBoards } from '../lib/api';
import { loginPath } from '../lib/navigation';
import TemplateExpandedCard from '../components/template/TemplateExpandedCard';
import Pagination from '../components/ui/Pagination';
import TearMascot from '../components/ui/TearMascot';

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

function TemplateCardSkeleton() {
  return (
    <div
      className="social-card bg-surface border border-line-soft rounded-[20px] p-6 animate-pulse space-y-4 min-h-[260px]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-tag" />
        <div className="h-4 w-32 bg-tag rounded" />
      </div>
      <div className="h-6 w-3/4 bg-tag rounded" />
      <div className="space-y-2">
        <div className="h-12 bg-tag rounded-xl" />
        <div className="h-12 bg-tag rounded-xl" />
      </div>
    </div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { addSavedIds } = useBookmarks();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const q = (params.get('q') || '').trim();
  const saved = params.get('view') === 'saved';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const sort = params.get('sort') || 'popular';

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tags, setTags] = useState([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchHashtags({ sort: 'popular', limit: 8, page: 1 }).then((result) => {
      if (!cancelled) setTags(result.error ? [] : result.data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadTemplates() {
      setIsLoading(true);
      setLoadError('');
      if (saved && !currentUser?.id) {
        setTemplates([]);
        setTotal(0);
        setIsLoading(false);
        return;
      }
      const { data, total: totalCount, error } = await fetchTemplates({
        page,
        limit: PAGE_SIZE,
        sort,
        q: q || undefined,
        saved: saved || undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (error) {
        setLoadError(error);
        setTemplates([]);
        setTotal(0);
      } else {
        const enriched = await hydrateBoards(data || [], controller.signal);
        if (controller.signal.aborted) return;
        setTemplates(enriched);
        setTotal(totalCount || 0);
        if (saved && data?.length) addSavedIds(data.map((template) => template.id));
      }
      setIsLoading(false);
    }
    loadTemplates().catch((error) => {
      if (!controller.signal.aborted) {
        setLoadError(error.message);
        setIsLoading(false);
      }
    });
    return () => controller.abort();
  }, [page, sort, q, saved, currentUser?.id, retry, addSavedIds]);

  useEffect(() => {
    const update = (event) => {
      if (
        saved &&
        event.detail?.id &&
        !event.detail.saved &&
        (!event.detail.userId || event.detail.userId === currentUser?.id)
      ) {
        setTemplates((previous) => previous.filter((template) => String(template.id) !== String(event.detail?.id)));
        setRetry((value) => value + 1);
      }
    };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [saved, currentUser?.id]);

  const useTemplate = (template) => {
    const next = `/rank?template=${encodeURIComponent(template.id)}`;
    navigate(next);
  };

  const handleSortChange = (nextSort) => {
    const next = new URLSearchParams(params);
    next.set('sort', nextSort);
    next.set('page', '1');
    setParams(next);
  };

  const setPage = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
    document.getElementById('discover-topics')?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q');
    next.delete('page');
    setParams(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="discover-v2 discover-simple mx-auto max-w-7xl px-4 py-5 text-ink sm:px-6 sm:py-8">
      {!q && !saved ? (
        <header className="discover-intro">
          <div>
            <p className="discover-kicker">{t('discover.title')}</p>
            <h1>{t('discover.browseTitle')}</h1>
          </div>
          <details className="discover-how-to">
            <summary>
              <CircleHelp size={17} />
              {t('discover.howToPlay')}
              <ChevronDown size={14} />
            </summary>
            <ol>
              {['choose', 'rank', 'compare'].map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  {t('discover.steps.' + step)}
                </li>
              ))}
            </ol>
          </details>
        </header>
      ) : (
        <div className="pulse-results-intro mb-4">
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('q');
              next.delete('view');
              next.delete('page');
              setParams(next);
            }}
            className="club-serial"
          >
            ← {t('discover.title')}
          </button>
          <h1 className="text-2xl font-bold mt-1 text-ink">
            {t(saved ? 'discover.savedTemplates' : 'pulse.searchHeading')}
          </h1>
        </div>
      )}

      <div className="discover-interest-row mb-6" aria-label={t('discover.interests')}>
        <span>{t('discover.interests')}</span>
        {tags.map((tag) => (
          <Link key={tag.tag} to={`/discover/hashtag/${encodeURIComponent(tag.tag.replace(/^#/, ''))}`}>
            #{tag.tag.replace(/^#/, '')}
          </Link>
        ))}
        <Link className="discover-interest-more" to="/discover/hashtags">
          {t('discover.moreInterests')}
          <ArrowRight size={14} />
        </Link>
      </div>

      <div id="discover-topics" className="mb-6 flex flex-wrap items-center justify-between gap-4 scroll-mt-20">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {q
              ? t('discover.searchResults', { q, count: total })
              : saved
              ? t('discover.savedTemplates')
              : sort === 'recent'
              ? t('discover.recentTemplates')
              : sort === 'views'
              ? t('discover.mostViewedTemplates')
              : t('discover.popularTemplates')}
          </h2>
          <span className="text-sm text-muted">
            {total.toLocaleString()} {t('common.templates')}
            {totalPages > 1 && (
              <span className="ml-1 text-ink-soft font-medium">
                ({t('common.page')} {page}/{totalPages})
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {q && (
            <button type="button" onClick={clearSearch} className="pulse-text-action text-sm">
              <X size={15} />
              {t('discover.clearSearch')}
            </button>
          )}
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
      </div>

      {loadError ? (
        <div role="alert" className="py-12 text-center">
          <p className="text-status-error">{loadError}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-brand px-4 py-2 text-canvas"
            onClick={() => setRetry((n) => n + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {Array.from({ length: 3 }, (_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </div>
      ) : saved && !currentUser ? (
        <div className="pulse-empty">
          <p>{t('discover.savedLogin')}</p>
          <Link to={loginPath('/discover?view=saved')} className="pulse-solid-link">
            {t('nav.login')}
          </Link>
        </div>
      ) : templates.length === 0 ? (
        saved ? (
          <div className="pulse-empty personality-empty">
            <TearMascot pose="quiet" />
            <strong>{t('discover.noSaved')}</strong>
            <p>{t('discover.savedEmptyHelp')}</p>
          </div>
        ) : (
          <div className="pulse-empty">{t('discover.noResults')}</div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {templates.map((template) => (
            <TemplateExpandedCard
              key={template.id}
              template={template}
              onUse={useTemplate}
              inSavedView={saved}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <footer className="discover-browse-footer mt-10">
        <p>{t('discover.makeTopicHelp')}</p>
        <Link to="/create">
          {t('discover.startTopic')}
          <ArrowRight size={16} />
        </Link>
      </footer>
    </main>
  );
}

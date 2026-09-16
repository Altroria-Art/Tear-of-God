import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, ArrowRight, X } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { fetchTemplates, fetchHashtags } from '../lib/api';
import { loginPath } from '../lib/navigation';
import TemplateCard from '../components/template/TemplateCard';
import HashtagPill from '../components/discover/HashtagPill';
import Pagination from '../components/ui/Pagination';
import { useTranslation } from 'react-i18next';

function TemplateCardSkeleton() {
  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col animate-pulse border border-line-soft">
      <div className="bg-surface/60 h-36 p-3 flex flex-col gap-2 justify-center items-center">
        <div className="w-16 h-3 bg-ink/10 rounded-full mb-1" />
        <div className="flex gap-1.5 justify-center">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-md bg-ink/10" />
          ))}
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between bg-surface/30 border-t border-line-soft gap-4">
        <div>
          <div className="h-4.5 bg-ink/10 rounded-md w-4/5 mb-2.5" />
          <div className="h-3 bg-ink/10 rounded-md w-1/2 mb-3" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-ink/10" />
            <div className="h-3 bg-ink/10 rounded w-20" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-ink/10 rounded-lg flex-1" />
          <div className="h-9 w-9 bg-ink/10 rounded-lg" />
          <div className="h-9 w-9 bg-ink/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const viewerId = currentUser?.id;
  const toast = useToast();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const q = (params.get('q') || '').trim();
  const saved = params.get('view') === 'saved';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

  const [templates, setTemplates] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [hashtagSections, setHashtagSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  const browsingResults = !!q || saved;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError('');

      if (saved && !viewerId) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }

      if (browsingResults) {
        const tpl = await fetchTemplates({
          q,
          saved,
          page,
          limit: 12,
        });
        if (cancelled) return;
        setTemplates(tpl.data || []);
        setTotal(tpl.total || 0);
        setLoadError(tpl.error || '');
      } else {
        const [tpl, tags] = await Promise.all([
          fetchTemplates({ limit: 4 }),
          fetchHashtags({ limit: 18, sort: 'used' }),
        ]);
        if (cancelled) return;

        setTemplates(tpl.data || []);
        setHashtags(tags.data || []);
        setTotal(tpl.total || 0);

        const top3 = (tags.data || []).slice(0, 3);
        const sectionsData = await Promise.all(
          top3.map((h) => fetchTemplates({ hashtag: h.tag, limit: 4 }))
        );
        if (cancelled) return;

        const newSections = top3
          .map((h, i) => ({
            tag: h.tag,
            items: sectionsData[i].data || [],
          }))
          .filter((section) => section.items.length);

        setHashtagSections(newSections);
        setLoadError(tpl.error || tags.error || '');
      }
      setIsLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q, saved, page, browsingResults, viewerId, retry]);

  useEffect(() => {
    const update = (event) => {
      if (saved && !event.detail.saved) setRetry((n) => n + 1);
    };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [saved]);

  const useTemplate = (template) => {
    const next = '/rank?template=' + encodeURIComponent(template.id);
    if (!currentUser) {
      toast.warning(t('discover.protectedLogin'));
      navigate(loginPath(next));
      return;
    }
    navigate(next);
  };

  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q');
    next.delete('page');
    setParams(next);
  };

  const grid = (list) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {list.map((template) => (
        <TemplateCard key={template.id} template={template} onUse={useTemplate} />
      ))}
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-10 text-ink">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            {t(saved ? 'discover.savedTemplates' : 'discover.title')}
          </h1>
          <p className="text-sm sm:text-base text-muted">
            {t(saved ? 'discover.savedHelp' : 'discover.subtitle')}
          </p>
        </div>

        <div>
          <Link
            to={saved ? '/discover' : '/discover?view=saved'}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all shadow-xs cursor-pointer ${
              saved
                ? 'bg-brand text-canvas border-brand shadow-sm'
                : 'border-line-soft bg-surface hover:bg-surface-glass text-ink'
            }`}
          >
            <Bookmark size={17} />
            {t(saved ? 'discover.explore' : 'discover.savedTemplates')}
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {saved && !currentUser ? (
        <div className="glass p-8 rounded-2xl text-center">
          <p className="mb-4">{t('discover.savedLogin')}</p>
          <Link
            className="inline-block bg-brand text-canvas rounded-xl px-5 py-3 font-semibold"
            to={loginPath('/discover?view=saved')}
          >
            {t('nav.login')}
          </Link>
        </div>
      ) : loadError ? (
        <div role="alert" className="glass p-8 rounded-2xl text-center">
          <p className="text-status-error font-medium">{loadError}</p>
          <button
            className="mt-4 px-4 py-2 rounded-xl bg-brand text-canvas text-sm font-semibold cursor-pointer"
            onClick={() => setRetry((n) => n + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 py-4">
          {[...Array(8)].map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : browsingResults ? (
        <section>
          {/* Results Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-line-soft">
            <h2 role="status" className="font-bold text-xl text-ink">
              {q
                ? t('discover.searchResults', { q, count: total })
                : t('discover.savedCount', { count: total })}
            </h2>

            {q && (
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-line-soft bg-surface hover:bg-surface-glass text-xs font-bold text-ink-soft hover:text-ink transition-colors cursor-pointer"
              >
                <X size={14} />
                <span>{t('discover.clearSearch')}</span>
              </button>
            )}
          </div>

          {/* Grid or Empty */}
          {templates.length ? (
            grid(templates)
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-muted">
              {t(saved ? 'discover.noSaved' : 'discover.noResults')}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={Math.ceil(total / 12)}
            onChange={(nextPage) => {
              const next = new URLSearchParams(params);
              next.set('page', nextPage);
              setParams(next);
            }}
          />
        </section>
      ) : (
        <>
          {/* Section: Popular Templates */}
          <section className="mb-10">
            <div className="flex justify-between items-center gap-4 mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🔥</span> {t('discover.popularTemplates')}
              </h2>
              <Link
                className="text-sm font-semibold text-brand hover:underline inline-flex items-center gap-1"
                to="/discover/templates"
              >
                {t('discover.viewAll')}
                <ArrowRight size={15} />
              </Link>
            </div>
            {templates.length ? (
              grid(templates.slice(0, 4))
            ) : (
              <p className="text-muted py-6">{t('discover.emptyTemplates')}</p>
            )}
          </section>

          {/* Section: Popular Hashtags */}
          <section className="mb-10">
            <div className="flex justify-between items-center gap-4 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🏷️</span> {t('discover.popularHashtags')}
              </h2>
              <Link className="text-sm font-semibold text-brand hover:underline" to="/discover/hashtags">
                {t('discover.viewAll')}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((h) => (
                <HashtagPill key={h.tag} tag={h.tag} count={h.content_count} />
              ))}
            </div>
          </section>

          {/* Section: Dynamic Hashtag Sections */}
          {hashtagSections.map(({ tag, items }) => (
            <section key={tag} className="mb-10">
              <div className="flex justify-between items-center gap-4 mb-5">
                <h2 className="text-xl font-bold">
                  <Link
                    to={'/discover/hashtag/' + encodeURIComponent(tag.replace(/^#/, ''))}
                    className="hover:underline hover:text-brand transition-colors"
                  >
                    {tag}
                  </Link>
                </h2>
                <Link
                  className="text-sm font-semibold text-brand hover:underline"
                  to={'/discover/hashtag/' + encodeURIComponent(tag.replace(/^#/, ''))}
                >
                  {t('discover.viewAll')}
                </Link>
              </div>
              {grid(items)}
            </section>
          ))}
        </>
      )}
    </main>
  );
}

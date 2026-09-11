import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Bookmark, ArrowRight } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { fetchTemplates, fetchHashtags } from '../lib/api';
import { loginPath } from '../lib/navigation';
import TemplateCard from '../components/template/TemplateCard';
import HashtagPill from '../components/discover/HashtagPill';
import Pagination from '../components/ui/Pagination';
import { useTranslation } from 'react-i18next';

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
  const [query, setQuery] = useState(q);
  const [templates, setTemplates] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const browsingResults = !!q || saved;

  useEffect(() => setQuery(q), [q]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError('');
      if (saved && !viewerId) { setTemplates([]); setIsLoading(false); return; }
      const [tpl, tags] = await Promise.all([
        fetchTemplates({ q, saved, page: browsingResults ? page : 1, limit: browsingResults ? 12 : 50 }),
        browsingResults ? Promise.resolve({ data: [] }) : fetchHashtags({ limit: 12, sort: 'used' }),
      ]);
      if (cancelled) return;
      setTemplates(tpl.data || []);
      setHashtags(tags.data || []);
      setTotal(tpl.total || 0);
      setLoadError(tpl.error || tags.error || '');
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [q, saved, page, browsingResults, viewerId, retry]);

  useEffect(() => {
    const update = event => { if (saved && !event.detail.saved) setRetry(n => n + 1); };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [saved]);

  const useTemplate = template => {
    const next = '/rank?template=' + encodeURIComponent(template.id);
    if (!currentUser) { toast.warning(t('discover.protectedLogin')); navigate(loginPath(next)); return; }
    navigate(next);
  };
  const sections = useMemo(() => hashtags.slice(0, 3).map(h => ({
    tag: h.tag,
    items: templates.filter(tpl => (tpl.hashtags || '').split(',').some(tag => tag.trim().replace(/^#/, '').toLowerCase() === h.tag.replace(/^#/, '').toLowerCase())).slice(0, 4),
  })).filter(section => section.items.length), [hashtags, templates]);
  const search = event => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    if (saved) next.set('view', 'saved');
    setParams(next);
  };
  const grid = list => <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">{list.map(template => <TemplateCard key={template.id} template={template} onUse={useTemplate} />)}</div>;

  return <main className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-10 text-ink">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">{t(saved ? 'discover.savedTemplates' : 'discover.title')}</h1>
        <p className="text-sm sm:text-base text-muted">{t(saved ? 'discover.savedHelp' : 'discover.subtitle')}</p>
      </div>
      <Link to={saved ? '/discover' : '/discover?view=saved'} className="inline-flex items-center gap-2 rounded-xl border border-line-soft bg-surface px-4 py-3 text-sm font-semibold"><Bookmark size={17} />{t(saved ? 'discover.explore' : 'discover.savedTemplates')}</Link>
    </div>
    <form onSubmit={search} role="search" className="flex gap-2 max-w-2xl mb-8">
      <div className="relative flex-1 min-w-0">
        <Search size={19} className="absolute left-4 top-3.5 text-muted pointer-events-none" />
        <input aria-label={t('discover.search')} placeholder={t('discover.search')} value={query} onChange={e => setQuery(e.target.value)} maxLength={100} className="w-full rounded-xl border border-line bg-surface text-ink py-3 pl-11 pr-4 text-sm" />
      </div>
      <button className="rounded-xl bg-brand text-canvas px-5 py-3 font-semibold text-sm">{t('discover.searchButton')}</button>
    </form>

    {saved && !currentUser ? <div className="glass p-8 rounded-2xl text-center"><p className="mb-4">{t('discover.savedLogin')}</p><Link className="inline-block bg-brand text-canvas rounded-xl px-5 py-3" to={loginPath('/discover?view=saved')}>{t('nav.login')}</Link></div>
      : loadError ? <div role="alert" className="glass p-8 rounded-2xl text-center"><p>{loadError}</p><button className="mt-4 underline" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</button></div>
      : isLoading ? <p role="status" className="text-center text-muted py-16">{t('common.loading')}</p>
      : browsingResults ? <section>
        <h2 role="status" className="font-semibold mb-5">{q ? t('discover.searchResults', { q, count: total }) : t('discover.savedCount', { count: total })}</h2>
        {templates.length ? grid(templates) : <div className="glass rounded-2xl p-8 text-center text-muted">{t(saved ? 'discover.noSaved' : 'discover.noResults')}</div>}
        <Pagination page={page} totalPages={Math.ceil(total / 12)} onChange={nextPage => { const next = new URLSearchParams(params); next.set('page', nextPage); setParams(next); }} />
      </section>
      : <>
        <section className="mb-10">
          <div className="flex justify-between items-center gap-4 mb-5"><h2 className="text-xl font-bold">{t('discover.popularTemplates')}</h2><Link className="text-sm inline-flex items-center gap-1" to="/discover/templates">{t('discover.viewAll')}<ArrowRight size={15} /></Link></div>
          {templates.length ? grid(templates.slice(0, 4)) : <p className="text-muted py-6">{t('discover.emptyTemplates')}</p>}
        </section>
        <section className="mb-10">
          <div className="flex justify-between items-center gap-4 mb-4"><h2 className="text-xl font-bold">{t('discover.popularHashtags')}</h2><Link className="text-sm" to="/discover/hashtags">{t('discover.viewAll')}</Link></div>
          <div className="flex flex-wrap gap-2">{hashtags.map(h => <HashtagPill key={h.tag} tag={h.tag} count={h.content_count} />)}</div>
        </section>
        {sections.map(({ tag, items }) => <section key={tag} className="mb-10">
          <div className="flex justify-between items-center gap-4 mb-5"><h2 className="text-xl font-bold">{tag}</h2><Link className="text-sm" to={'/discover/hashtag/' + encodeURIComponent(tag.replace(/^#/, ''))}>{t('discover.viewAll')}</Link></div>
          {grid(items)}
        </section>)}
      </>}
  </main>;
}

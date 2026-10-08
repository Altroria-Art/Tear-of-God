import HomeCommunityPulse from '../components/feed/HomeCommunityPulse';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bookmark, X, ChevronDown, CircleHelp, Flame, Sparkles, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { useBookmarks } from '../context/BookmarkContext';
import { trackEvent } from '../lib/analytics';
import { fetchDiscoverPulse, fetchTemplates, fetchTemplate, fetchHashtags } from '../lib/api';
import { loginPath } from '../lib/navigation';
import TemplateCard from '../components/template/TemplateCard';
import Pagination from '../components/ui/Pagination';
import TearMascot from '../components/ui/TearMascot';

const WINDOWS = ['now', 'today', 'week', 'last_week'];

const TABS = [{ key: 'popular', Icon: Flame }, { key: 'new', Icon: Sparkles }, { key: 'active', Icon: MessageCircle }];
function TemplateCardSkeleton() {
  return <div className="discover-topic-card aspect-square animate-pulse border border-line-soft bg-surface" aria-hidden="true" />;
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
  const requestedWindow = WINDOWS.includes(params.get('window')) ? params.get('window') : 'now';
  const tab = TABS.some(item => item.key === params.get('tab')) ? params.get('tab') : params.has('window') ? 'active' : 'popular';
  const browsingResults = !!q || saved;
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pulse, setPulse] = useState(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseError, setPulseError] = useState('');
  const [retry, setRetry] = useState(0);
  const [topicResult, setTopicResult] = useState({ tab: '', data: [], loading: true, error: '' });
  const [tags, setTags] = useState([]);
  const topicCache = useRef(new Map());

  useEffect(() => {
    if (browsingResults) return undefined;
    let cancelled = false;
    fetchHashtags({ sort: 'popular', limit: 6, page: 1 }).then(result => {
      if (!cancelled) setTags(result.error ? [] : result.data || []);
    });
    return () => { cancelled = true; };
  }, [browsingResults, retry]);

  useEffect(() => {
    if (browsingResults || tab === 'active') return undefined;
    let cancelled = false;
    setTopicResult({ tab, data: [], loading: true, error: '' });
    fetchTemplates({ sort: tab === 'new' ? 'recent' : 'popular', limit: 8, page: 1 }).then(result => {
      if (cancelled) return;
      const data = result.error ? [] : result.data || [];
      data.forEach(topic => topicCache.current.set(topic.id, topic));
      setTopicResult({ tab, data, loading: false, error: result.error || '' });
    });
    return () => { cancelled = true; };
  }, [browsingResults, tab, retry]);

  useEffect(() => {
    if (browsingResults || tab !== 'active' || pulseLoading) return undefined;
    let cancelled = false;
    setTopicResult({ tab, data: [], loading: true, error: '' });
    // Preserve Pulse activity order, with full topic metadata for the shared cards.
    Promise.all((pulse?.templates || []).map(async topic => {
      const cached = topicCache.current.get(topic.id);
      if (cached) return { data: cached };
      const result = await fetchTemplate(topic.id, { light: true });
      return result.data ? { data: { ...result.data, use_count: result.data.stats?.uses || 0 } } : result;
    })).then(results => {
      if (cancelled) return;
      setTopicResult({ tab, data: results.filter(result => result.data).map(result => result.data), loading: false,
        error: pulseError || results.find(result => result.error)?.error || '' });
    });
    return () => { cancelled = true; };
  }, [browsingResults, tab, pulse, pulseLoading, pulseError, retry]);

  useEffect(() => {
    if (!browsingResults) return undefined;
    let cancelled = false;
    async function loadResults() {
      setIsLoading(true);
      setLoadError('');
      if (saved && !currentUser?.id) {
        setTemplates([]); setTotal(0); setIsLoading(false); return;
      }
      const result = await fetchTemplates({ q, saved, page, limit: 12 });
      if (cancelled) return;
      const lastPage = Math.max(1, Math.ceil((result.total || 0) / 12));
      if (!result.error && page > lastPage) {
        setParams(current => {
          const next = new URLSearchParams(current);
          if (lastPage === 1) next.delete('page'); else next.set('page', String(lastPage));
          return next;
        }, { replace: true });
        return;
      }
      setTemplates(result.data || []);
      setTotal(result.total || 0);
      setLoadError(result.error || '');
      if (saved && result.data?.length) addSavedIds(result.data.map(template => template.id));
      setIsLoading(false);
    }
    loadResults();
    return () => { cancelled = true; };
  }, [q, saved, page, browsingResults, currentUser?.id, retry, addSavedIds, setParams]);

  useEffect(() => {
    if (browsingResults) return undefined;
    let cancelled = false;
    setPulseLoading(true);
    setPulseError('');
    fetchDiscoverPulse(requestedWindow).then(result => {
      if (cancelled) return;
      if (result.success && result.fallback_from) {
        trackEvent('discover_fallback', {
          entityType: 'discover_window',
          entityId: `${result.fallback_from}:${result.window}`,
          onceKey: `fallback:${result.fallback_from}->${result.window}`
        });
      }
      setPulse(result.success ? result : null);
      setPulseError(result.error || '');
      setPulseLoading(false);
    });
    return () => { cancelled = true; };
  }, [browsingResults, requestedWindow, retry]);

  useEffect(() => {
    const update = event => {
      if (saved && event.detail?.id && !event.detail.saved && (!event.detail.userId || event.detail.userId === currentUser?.id)) {
        setTemplates(previous => previous.filter(template => String(template.id) !== String(event.detail?.id)));
        setRetry(value => value + 1);
      }
    };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [saved, currentUser?.id]);

  const useTemplate = template => {
    const next = `/rank?template=${encodeURIComponent(template.id)}`;
    navigate(next);
  };
  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q'); next.delete('page');
    setParams(next);
  };
  const templateGrid = <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
    {templates.map(template => <TemplateCard compact key={template.id} template={template} onUse={useTemplate} inSavedView={saved} />)}
  </div>;

  const topicsLoading = topicResult.tab !== tab || topicResult.loading || (tab === 'active' && pulseLoading);
  const topics = topicResult.tab === tab ? topicResult.data : [];
  const gridClass = 'discover-browse-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';
  const conversations = [...(pulse?.discussions || []), ...(pulse?.rankings || [])]
    .filter((item, index, items) => item.id && items.findIndex(other => other.id === item.id) === index).slice(0, 4);
  const changeTab = nextTab => {
    const next = new URLSearchParams(params); next.set('tab', nextTab); next.delete('page'); setParams(next);
  };

  return <main className="discover-v2 discover-pulse discover-simple mx-auto max-w-7xl px-4 py-5 text-ink sm:px-6 sm:py-8">
    {!browsingResults && <header className="discover-intro">
      <div><p className="discover-kicker">{t('discover.title')}</p><h1>{t('discover.browseTitle')}</h1><p className="discover-intro-help">{t('discover.browseHelp')}</p></div>
      <details className="discover-how-to"><summary><CircleHelp size={17} />{t('discover.howToPlay')}<ChevronDown size={14} /></summary>
        <ol>{['choose', 'rank', 'compare'].map((step, index) => <li key={step}><span>{index + 1}</span>{t('discover.steps.' + step)}</li>)}</ol>
      </details>
    </header>}
    {browsingResults && <Link to="/discover/templates" className="opinion-secondary mb-3 gap-2">{t('pulse.allTemplates')} <ArrowRight size={16} /></Link>}
    {browsingResults && <div className="pulse-results-intro"><Link to="/discover" className="club-serial">← {t('discover.title')}</Link>
      <h1>{t(saved ? 'discover.savedTemplates' : 'pulse.searchHeading')}</h1></div>}

    {browsingResults ? <>
      <div className="pulse-results-head"><div><h2 role="status">{q ? t('discover.searchResults', { q, count: total }) : saved && !currentUser ? t('discover.savedTemplates') : t('discover.savedCount', { count: total })}</h2>
        <p>{t(saved ? 'discover.savedHelp' : 'discover.subtitle')}</p></div>
        <div className="flex flex-wrap gap-2">{q && <button type="button" onClick={clearSearch} className="pulse-text-action"><X size={15} />{t('discover.clearSearch')}</button>}
          <Link to={saved ? '/discover' : '/discover?view=saved'} className="pulse-text-action"><Bookmark size={16} />{t(saved ? 'discover.explore' : 'discover.savedTemplates')}</Link></div>
      </div>
      {saved && !currentUser ? <div className="pulse-empty"><p>{t('discover.savedLogin')}</p><Link to={loginPath('/discover?view=saved')} className="pulse-solid-link">{t('nav.login')}</Link></div>
        : loadError ? <div role="alert" className="pulse-empty"><p>{loadError}</p><button type="button" className="pulse-solid-link" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button></div>
        : isLoading ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <TemplateCardSkeleton key={index} />)}</div>
          : templates.length ? templateGrid : saved ? <div className="pulse-empty personality-empty"><TearMascot pose="quiet" /><strong>{t('discover.noSaved')}</strong><p>{t('discover.savedEmptyHelp')}</p><Link to="/discover/templates" className="pulse-solid-link">{t('discover.savedEmptyCta')}</Link></div> : <div className="pulse-empty">{t('discover.noResults')}</div>}
      <Pagination page={page} totalPages={Math.ceil(total / 12)} onChange={nextPage => {
        const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next);
      }} />
    </> : <>
      {pulseLoading ? <div className="discover-pulse-placeholder animate-pulse" aria-label={t('pulse.loading')} />
        : !pulseError && pulse ? <HomeCommunityPulse pulse={pulse} compact /> : null}
      <section aria-label={t('discover.browseTopics')} className="discover-browser">
        <div className="discover-browse-toolbar">
          <div className="discover-browse-tabs" role="group" aria-label={t('discover.browseTopics')}>
            {TABS.map(({ key, Icon }) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}><Icon size={17} aria-hidden="true" />{t(`discover.browseTabs.${key}`)}</button>)}
          </div>
          {tab === 'active' ? <label className="discover-period"><span>{t('pulse.timeWindow')}</span><select value={requestedWindow} onChange={event => {
            const next = new URLSearchParams(params); next.set('window', event.target.value); setParams(next);
          }}>{WINDOWS.map(window => <option key={window} value={window}>{t(`pulse.windows.${window}`)}</option>)}</select></label>
            : <Link className="discover-all-link" to={`/discover/templates?sort=${tab === 'new' ? 'recent' : 'popular'}`}>{t('discover.viewAll')}<ArrowRight size={15} /></Link>}
        </div>
        <div className="discover-interest-row" aria-label={t('discover.interests')}>
          <span>{t('discover.interests')}</span>
          {tags.map(tag => <Link key={tag.tag} to={`/discover/hashtag/${encodeURIComponent(tag.tag.replace(/^#/, ''))}`}>#{tag.tag.replace(/^#/, '')}</Link>)}
          <Link className="discover-interest-more" to="/discover/hashtags">{t('discover.moreInterests')}<ArrowRight size={14} /></Link>
        </div>
        <p className="discover-grid-description">{t(`discover.browseDescriptions.${tab}`)}</p>
        {tab === 'active' && pulse?.fallback_from && !pulseLoading && <p className="discover-activity-note" role="status">{t('pulse.displayedPeriod', { period: t(`pulse.windows.${pulse.window}`) })}</p>}
        {topicsLoading ? <div className={gridClass} aria-busy="true" aria-label={t('discover.loadingTemplates')}>{Array.from({ length: tab === 'active' ? 4 : 8 }, (_, index) => <TemplateCardSkeleton key={index} />)}</div>
          : <>
            {!!topics.length && <div className={gridClass}>{topics.map(template => <TemplateCard compact key={template.id} template={template} onUse={useTemplate} />)}</div>}
            {topicResult.error && <div className="discover-inline-error" role="alert"><p>{topicResult.error}</p><button type="button" className="pulse-text-action" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button></div>}
            {!topics.length && !topicResult.error && <div className="pulse-empty"><p>{t(tab === 'active' ? 'pulse.quietDescription' : 'discover.emptyTemplates')}</p></div>}
          </>}
        {tab === 'active' && conversations.length > 0 && !pulseLoading && <details className="discover-conversations"><summary>{t('discover.recentConversations')}<ChevronDown size={16} /></summary>
          <div>{conversations.map(item => <Link key={item.id} to={`/post/${encodeURIComponent(item.id)}`}><strong>{item.title}</strong><span>{item.comments ? t('homeDiscovery.comments', { count: item.comments }) : t('homeDiscovery.newRanking')}<ArrowRight size={15} /></span></Link>)}</div>
        </details>}
        <footer className="discover-browse-footer"><p>{t('discover.makeTopicHelp')}</p><Link to="/create">{t('discover.startTopic')}<ArrowRight size={16} /></Link><Link to="/discover?view=saved"><Bookmark size={16} />{t('discover.savedTemplates')}</Link></footer>
      </section>
    </>}
  </main>;
}

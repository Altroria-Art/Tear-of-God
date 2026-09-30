import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bookmark, MessageCircle, Search, X, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useToast } from '../components/ui/Toast';
import { trackEvent } from '../lib/analytics';
import { fetchDiscoverPulse, fetchTemplates } from '../lib/api';
import { loginPath } from '../lib/navigation';
import TemplateCard from '../components/template/TemplateCard';
import Pagination from '../components/ui/Pagination';
import RipMark from '../components/ui/RipMark';

const WINDOWS = ['now', 'today', 'week', 'last_week'];

const getFallbackKey = (fallbackFrom, effective) => {
  if (fallbackFrom === 'now' && effective === 'today') return 'pulse.fallbackNowToday';
  if (fallbackFrom === 'now' && effective === 'week') return 'pulse.fallbackNowWeek';
  if (fallbackFrom === 'today' && effective === 'week') return 'pulse.fallbackTodayWeek';
  return 'pulse.fallbackNotice';
};

function TemplateCardSkeleton() {
  return <div className="social-card h-72 animate-pulse border border-line-soft bg-surface" aria-hidden="true" />;
}

function PulseSignals({ item, t, showRankings = true }) {
  return <span className="pulse-signals">
    {showRankings && item.ranking_count > 0 && <span>{t('pulse.rankingsCount', { count: item.ranking_count })}</span>}
    {item.comments > 0 && <span>{t('pulse.commentsCount', { count: item.comments })}</span>}
    {item.reactions > 0 && <span>{t('pulse.reactionsCount', { count: item.reactions })}</span>}
    {!item.ranking_count && !item.comments && !item.reactions && <span>{t('pulse.recentActivity')}</span>}
  </span>;
}

function SectionTitle({ number, eyebrow, title, action }) {
  return <div className="pulse-section-head">
    <div><p className="club-serial text-muted">{number} / {eyebrow}</p><h2>{title}</h2></div>
    {action}
  </div>;
}

function TopicCard({ topic, index, t }) {
  return <Link to={topic.href} className={`pulse-topic pulse-topic--${index === 0 ? 'lead' : index % 3 === 1 ? 'violet' : 'cyan'}`}>
    <span className="pulse-topic-kicker">{t('pulse.topic')} / {String(index + 1).padStart(2, '0')}</span>
    <strong className="pulse-topic-title">{topic.label}</strong>
    {topic.preview_rankings?.[0]?.title && <span className="pulse-topic-preview">{topic.preview_rankings[0].title}</span>}
    <span className="pulse-topic-footer"><PulseSignals item={topic} t={t} /><ArrowRight size={19} aria-hidden="true" /></span>
  </Link>;
}

function RankingCard({ ranking, t }) {
  return <Link to={`/post/${encodeURIComponent(ranking.id)}`} className="pulse-ranking-card">
    <span className="club-serial text-muted">{ranking.new_ranking ? t('pulse.newRanking') : t('pulse.recentActivity')}</span>
    <strong>{ranking.title}</strong>
    {ranking.template_title && <span className="pulse-card-context">{ranking.template_title}</span>}
    <span className="pulse-card-bottom"><PulseSignals item={ranking} t={t} showRankings={false} /><ArrowRight size={17} aria-hidden="true" /></span>
  </Link>;
}

function DiscussionCard({ ranking, t }) {
  return <Link to={`/post/${encodeURIComponent(ranking.id)}`} className="pulse-discussion-card">
    <span className="pulse-discussion-mark"><MessageCircle size={20} aria-hidden="true" /></span>
    <span className="min-w-0"><span className="club-serial text-muted">{ranking.author_name ? `@${ranking.author_name}` : ranking.template_title || t('pulse.community')}</span>
      <strong>{ranking.title}</strong><span className="pulse-card-context">{t('pulse.commentsCount', { count: ranking.comments })}</span></span>
    <ArrowRight className="shrink-0" size={18} aria-hidden="true" />
  </Link>;
}

function ActiveTemplate({ template, t }) {
  return <Link to={`/template/${encodeURIComponent(template.id)}`} className="pulse-template-card">
    <span className="club-serial text-muted">{t('pulse.templateInPlay')}</span>
    <strong>{template.title}</strong>
    {template.creator_name && <span className="pulse-card-context">@{template.creator_name}</span>}
    {!!template.preview_items?.length && <span className="pulse-template-preview" aria-label={t('pulse.itemPreview')}>
      {template.preview_items.map((item, index) => <span key={`${item.name}-${index}`} title={item.tier || undefined}>{item.name}</span>)}
    </span>}
    {template.preview_ranking?.title && <span className="pulse-card-context">{t('pulse.latestTake')}: {template.preview_ranking.title}</span>}
    <span className="pulse-card-bottom"><PulseSignals item={template} t={t} /><ArrowRight size={17} aria-hidden="true" /></span>
  </Link>;
}

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { addSavedIds } = useBookmarks();
  const toast = useToast();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const saved = params.get('view') === 'saved';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const requestedWindow = WINDOWS.includes(params.get('window')) ? params.get('window') : 'now';
  const browsingResults = !!q || saved;
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pulse, setPulse] = useState(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseError, setPulseError] = useState('');
  const [retry, setRetry] = useState(0);

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
    if (!currentUser) { toast.warning(t('discover.protectedLogin')); navigate(loginPath(next)); return; }
    navigate(next);
  };
  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q'); next.delete('page');
    setParams(next);
  };
  const templateGrid = <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
    {templates.map(template => <TemplateCard key={template.id} template={template} onUse={useTemplate} inSavedView={saved} />)}
  </div>;

  return <main className="discover-v2 discover-pulse mx-auto max-w-7xl px-4 py-5 text-ink sm:px-6 sm:py-6">
    {!browsingResults && <header className="pulse-hero">
      <p className="club-serial pulse-hero-kicker">TEAR OF GOD / {t('pulse.eyebrow')}</p>
      <h1><span>{t('pulse.heroFirst')}</span><span><mark>{t('pulse.heroSecond')}</mark></span></h1>
      <RipMark className="pulse-hero-rip" />
      <p>{t('pulse.heroDescription')}</p>
    </header>}
    {browsingResults && <div className="pulse-results-intro"><Link to="/discover" className="club-serial">← {t('pulse.backToPulse')}</Link>
      <h1>{t(saved ? 'discover.savedTemplates' : 'pulse.searchHeading')}</h1></div>}

    <form role="search" className="pulse-search" onSubmit={event => {
      event.preventDefault();
      const query = String(new FormData(event.currentTarget).get('query') || '').trim();
      const next = new URLSearchParams(params);
      if (query) next.set('q', query); else next.delete('q');
      next.delete('page'); setParams(next);
    }}>
      <Search size={18} aria-hidden="true" /><input key={q} name="query" type="search" defaultValue={q} aria-label={t('discover.search')} placeholder={t('nav.searchPlaceholder')} />
      <button type="submit" className="pulse-search-button">{t('play.searchAction')}</button>
    </form>

    {browsingResults ? <>
      <div className="pulse-results-head"><div><h2 role="status">{q ? t('discover.searchResults', { q, count: total }) : t('discover.savedCount', { count: total })}</h2>
        <p>{t(saved ? 'discover.savedHelp' : 'discover.subtitle')}</p></div>
        <div className="flex flex-wrap gap-2">{q && <button type="button" onClick={clearSearch} className="pulse-text-action"><X size={15} />{t('discover.clearSearch')}</button>}
          <Link to={saved ? '/discover' : '/discover?view=saved'} className="pulse-text-action"><Bookmark size={16} />{t(saved ? 'discover.explore' : 'discover.savedTemplates')}</Link></div>
      </div>
      {saved && !currentUser ? <div className="pulse-empty"><p>{t('discover.savedLogin')}</p><Link to={loginPath('/discover?view=saved')} className="pulse-solid-link">{t('nav.login')}</Link></div>
        : loadError ? <div role="alert" className="pulse-empty"><p>{loadError}</p><button type="button" className="pulse-solid-link" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button></div>
        : isLoading ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <TemplateCardSkeleton key={index} />)}</div>
          : templates.length ? templateGrid : <div className="pulse-empty">{t(saved ? 'discover.noSaved' : 'discover.noResults')}</div>}
      <Pagination page={page} totalPages={Math.ceil(total / 12)} onChange={nextPage => {
        const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next);
      }} />
    </> : <>
      <section className="pulse-lead-section" aria-labelledby="pulse-heading">
        <div className="pulse-section-head pulse-section-head--lead"><div><p className="club-serial text-muted">01 / {t('pulse.eyebrow')}</p><h2 id="pulse-heading">{t('pulse.communityPulse')}</h2></div>
          <span className="pulse-live-mark">{t('pulse.fromRealActivity')}</span></div>
        <div className="pulse-tabs" role="group" aria-label={t('pulse.timeWindow')} style={{ '--pulse-tab-index': WINDOWS.indexOf(requestedWindow) }}>
          {WINDOWS.map(window => <button key={window} type="button" aria-pressed={requestedWindow === window}
            className={requestedWindow === window ? 'is-active' : ''}
            onClick={() => { const next = new URLSearchParams(params); next.set('window', window); setParams(next); }}>
            {t(`pulse.windows.${window}`)}</button>)}
        </div>
        {pulse?.fallback_from && pulse.active_rankings > 0 && !pulseLoading && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line-soft bg-surface-glass p-3.5 text-sm font-medium text-ink shadow-xs transition-opacity duration-300 motion-safe:animate-in motion-safe:fade-in motion-reduce:transition-none" role="status">
            <Info size={16} className="text-brand shrink-0" aria-hidden="true" />
            <p>{t(getFallbackKey(pulse.fallback_from, pulse.window))}</p>
          </div>
        )}
        {pulse?.sampled && !pulseLoading && <p className="pulse-sample-note">{t('pulse.sampleNote')}</p>}
        {pulseError ? <div className="pulse-empty" role="alert"><p>{pulseError}</p><button type="button" className="pulse-solid-link" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button></div>
          : pulseLoading ? <div className="pulse-topic-grid" aria-label={t('pulse.loading')}>{Array.from({ length: 3 }, (_, index) => <div key={index} className="pulse-topic pulse-topic--skeleton animate-pulse" />)}</div>
            : pulse?.active_rankings ? <div key={pulse.window} className="pulse-topic-grid pulse-content-enter">{pulse.topics.map((topic, index) => <TopicCard key={topic.key} topic={topic} index={index} t={t} />)}</div>
              : <div className="pulse-empty"><strong>{t('pulse.quietTitle')}</strong><p>{t('pulse.quietDescription')}</p><Link className="pulse-solid-link" to="/discover/templates">{t('pulse.exploreTemplates')}</Link></div>}
      </section>

      {!!pulse?.rankings?.length && !pulseLoading && <section className="pulse-section">
        <SectionTitle number="02" eyebrow={t('pulse.activityEyebrow')} title={t('pulse.activeHeading')} />
        <div className="pulse-ranking-grid">{pulse.rankings.map(ranking => <RankingCard key={ranking.id} ranking={ranking} t={t} />)}</div>
      </section>}
      {!!pulse?.discussions?.length && !pulseLoading && <section className="pulse-section">
        <SectionTitle number="03" eyebrow={t('pulse.discussionEyebrow')} title={t('pulse.discussionHeading')} />
        <div className="pulse-discussion-list">{pulse.discussions.map(ranking => <DiscussionCard key={ranking.id} ranking={ranking} t={t} />)}</div>
      </section>}
      {!!pulse?.hashtags?.length && !pulseLoading && <section className="pulse-section">
        <SectionTitle number="04" eyebrow={t('pulse.topicsEyebrow')} title={t('pulse.hashtagHeading')}
          action={<Link className="pulse-section-link" to="/discover/hashtags">{t('discover.viewAll')} <ArrowRight size={16} /></Link>} />
        <div className="pulse-hashtags">{pulse.hashtags.map(tag => <Link key={tag.key} to={tag.href} className="pulse-hashtag">
          <strong>{tag.label}</strong><span>{t('pulse.activityCount', { count: tag.activity_count })}</span></Link>)}</div>
      </section>}
      {!!pulse?.templates?.length && !pulseLoading && <section className="pulse-section">
        <SectionTitle number="05" eyebrow={t('pulse.templatesEyebrow')} title={t('pulse.templatesHeading')}
          action={<Link className="pulse-section-link" to="/discover/templates">{t('discover.viewAll')} <ArrowRight size={16} /></Link>} />
        <div className="pulse-template-grid">{pulse.templates.map(template => <ActiveTemplate key={template.id} template={template} t={t} />)}</div>
      </section>}
      <section className="pulse-explore pulse-section">
        <SectionTitle number="06" eyebrow={t('pulse.exploreEyebrow')} title={t('pulse.exploreHeading')} />
        <div><Link to="/discover/templates">{t('pulse.allTemplates')} <ArrowRight size={16} /></Link>
          <Link to="/discover/hashtags">{t('pulse.allHashtags')} <ArrowRight size={16} /></Link>
          <Link to="/discover?view=saved">{t('discover.savedTemplates')} <ArrowRight size={16} /></Link></div>
      </section>
    </>}
  </main>;
}

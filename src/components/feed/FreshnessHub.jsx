import { ChevronRight, Clock3, Flame, MessageCircle, Scale, Sparkles, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { fetchSpotlights } from '../../lib/api';
import { formatCount, timeAgo } from '../../lib/format';

const RANKING_SECTIONS = [
  { key: 'hot24', Icon: Flame, tone: 'text-aurora-orange', border: 'border-aurora-orange/25' },
  { key: 'recent', Icon: Clock3, tone: 'text-brand', border: 'border-brand/25' },
  { key: 'debate', Icon: MessageCircle, tone: 'text-aurora-purple', border: 'border-aurora-purple/25' },
  { key: 'split', Icon: Scale, tone: 'text-rose-500', border: 'border-rose-400/25' },
];

function RankingCard({ ranking }) {
  const { t } = useTranslation();
  const next = `/post/${ranking.id}`;
  return (
    <Link
      to={next}
      data-auth-next={next}
      className="block min-w-[17rem] snap-start rounded-xl border border-line-soft bg-surface/80 p-3 transition-colors hover:border-highlight"
    >
      <p className="line-clamp-2 text-sm font-extrabold leading-snug text-ink">{ranking.title}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-muted">
        {ranking.profile?.username || t('common.unknownUser')} · {timeAgo(ranking.created_at)}
      </p>
      <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1"><ThumbsUp size={13} /> {formatCount(ranking.stats?.likes || 0)}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {formatCount(ranking.stats?.comments || 0)}</span>
        {ranking.disagreement > 0 && <span className="ml-auto text-rose-500">{t('freshness.splitScore', { score: ranking.disagreement })}</span>}
      </div>
    </Link>
  );
}

function ScrollTrack({ children, hasMore = true, label }) {
  const trackRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const hoveredRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const scrollNext = () => {
    setPaused(true);
    window.clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = window.setTimeout(() => {
      if (!hoveredRef.current) setPaused(false);
    }, 7000);

    trackRef.current?.scrollBy({ left: Math.max(220, trackRef.current.clientWidth * 0.8), behavior: 'smooth' });
  };

  useEffect(() => {
    if (!hasMore || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;

    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track || paused || hoveredRef.current || track.scrollWidth <= track.clientWidth + 4) return;

      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScrollLeft - 8) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: Math.max(220, track.clientWidth * 0.8), behavior: 'smooth' });
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasMore, paused]);

  useEffect(() => () => window.clearTimeout(pauseTimerRef.current), []);

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    setPaused(true);
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    setPaused(false);
  };

  const handlePointerDown = () => {
    setPaused(true);
    window.clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = window.setTimeout(() => {
      if (!hoveredRef.current) setPaused(false);
    }, 7000);
  };

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onPointerDown={handlePointerDown}
    >
      <div
        ref={trackRef}
        aria-label={label}
        className="flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-2 pr-7 hide-scrollbar cursor-grab touch-pan-x active:cursor-grabbing"
      >
        {children}
      </div>
      {hasMore && (
        <button
          type="button"
          data-guest-allowed="true"
          aria-label={label}
          onClick={scrollNext}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-end rounded-r-lg bg-gradient-to-l from-surface via-surface/90 to-transparent pl-3 pr-0.5 text-muted transition-colors hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function Section({ section, items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  const { Icon } = section;
  return (
    <div className={`rounded-2xl border ${section.border} bg-surface/60 p-3`}>
      <h3 className={`flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] ${section.tone}`}>
        <Icon size={14} aria-hidden="true" />
        {t(`freshness.${section.key}`)}
      </h3>
      <div className="mt-2">
        <ScrollTrack hasMore={items.length > 1} label={t('freshness.scrollHint')}>
          {items.slice(0, 3).map((item) => <RankingCard key={item.id} ranking={item} />)}
        </ScrollTrack>
      </div>
    </div>
  );
}

export default function FreshnessHub() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSpotlights().then((result) => {
      if (cancelled) return;
      setData(result?.data || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const freshness = data?.freshness || {};
  const hasFreshness = RANKING_SECTIONS.some((section) => freshness[section.key]?.length > 0);
  if (!loading && !hasFreshness) return null;

  return (
    <section aria-labelledby="freshness-heading" className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
            <Sparkles size={12} aria-hidden="true" />
            {t('freshness.eyebrow')}
          </p>
          <h2 id="freshness-heading" className="mt-0.5 text-lg font-black text-ink">{t('freshness.title')}</h2>
        </div>
        <p className="hidden text-right text-xs font-medium text-muted sm:block">{t('freshness.subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={t('freshness.loading')}>
          {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-line-soft bg-surface/60" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {RANKING_SECTIONS.map((section) => <Section key={section.key} section={section} items={freshness[section.key]} />)}
          </div>

        </>
      )}
    </section>
  );
}

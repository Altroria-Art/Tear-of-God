import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HEADING_KEYS = {
  now: 'homeDiscovery.railNow',
  today: 'homeDiscovery.railToday',
  week: 'homeDiscovery.railWeek',
  last_week: 'homeDiscovery.railLastWeek',
};

export default function HomePulseTopics({ topics, window = 'now', sampled = false, variant = 'strip' }) {
  const { t } = useTranslation();
  if (!topics?.length) return null;

  if (variant === 'rail') {
    return <section aria-labelledby="home-pulse-heading" className="home-pulse-rail rounded-2xl border border-line-soft bg-surface p-4 text-ink">
      <h2 id="home-pulse-heading" className="text-xs font-black uppercase tracking-[0.12em] text-ink">
        {t(HEADING_KEYS[window] || HEADING_KEYS.now)}
      </h2>
      <ol className="mt-3 divide-y divide-line-soft">
        {topics.slice(0, 4).map(topic => <li key={topic.key}>
          <Link to={topic.href} className="group flex min-h-14 items-center justify-between gap-3 py-2 transition-colors hover:text-brand">
            <span className="min-w-0 truncate text-sm font-bold">{topic.label}</span>
            <span className="shrink-0 text-[11px] font-medium text-muted">
              {t('homeDiscovery.activeRankings', { count: topic.active_rankings })}
            </span>
          </Link>
        </li>)}
      </ol>
      {sampled && <p className="mt-2 text-[11px] leading-snug text-muted">{t('pulse.sampleNote')}</p>}
      <Link to="/discover" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-ink transition-colors hover:text-brand">
        {t('homeDiscovery.exploreMore')} <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>;
  }

  return <section aria-label={t('homeDiscovery.stripAria')} className="home-pulse-strip hidden min-w-0 items-center gap-3 rounded-xl border border-line-soft bg-surface px-3 py-2 md:flex">
    <Link to="/discover" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-black text-ink transition-colors hover:text-brand">
      {t('homeDiscovery.stripTitle')} <ArrowRight size={14} aria-hidden="true" />
    </Link>
    <span className="h-5 w-px shrink-0 bg-line-soft" aria-hidden="true" />
    <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain hide-scrollbar">
      <div className="flex w-max items-center gap-2">
        {topics.slice(0, 5).map(topic => <Link key={topic.key} to={topic.href}
          className="inline-flex min-h-9 max-w-48 items-center rounded-full border border-line-soft bg-surface-glass px-3 text-xs font-bold text-ink-soft transition-colors hover:border-line hover:bg-surface hover:text-brand">
          <span className="truncate">{topic.label}</span>
        </Link>)}
      </div>
    </div>
  </section>;
}

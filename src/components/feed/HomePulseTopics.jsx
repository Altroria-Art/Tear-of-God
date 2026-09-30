import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HomePulseTopics({ topics }) {
  const { t } = useTranslation();
  if (!topics?.length) return null;

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

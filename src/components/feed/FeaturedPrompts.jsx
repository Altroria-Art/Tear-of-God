import { formatHashtags } from '../../lib/hashtags';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchSpotlights } from '../../lib/api';
import { formatCount } from '../../lib/format';
import { loginPath } from '../../lib/navigation';
import { useUser } from '../../context/UserContext';
import { useToast } from '../ui/Toast';

const PROMPT_STYLES = {
  daily: {
    Icon: Clock3,
    accent: 'text-aurora-orange',
    tint: 'bg-aurora-orange/10',
    border: 'border-aurora-orange/25'
  },
  weekly: {
    Icon: CalendarDays,
    accent: 'text-aurora-purple',
    tint: 'bg-aurora-purple/10',
    border: 'border-aurora-purple/25'
  }
};

function formatCountdown(endsAt, t) {
  const remaining = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalMinutes = Math.ceil(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return t('spotlights.timeDays', { days, hours });
  if (hours > 0) return t('spotlights.timeHours', { hours, minutes });
  return t('spotlights.timeMinutes', { minutes });
}

function PromptCard({ kind, prompt, tick, onUse, compact = false }) {
  const { t } = useTranslation();
  const style = PROMPT_STYLES[kind];
  const { Icon } = style;
  const template = prompt?.template;

  if (!template) return null;

  return (
    <article className={`relative overflow-hidden rounded-2xl border ${style.border} bg-surface/80 ${compact ? 'p-3' : 'p-4 shadow-panel'}`}>
      <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl ${style.tint}`} />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${style.accent}`}>
              <Icon size={14} aria-hidden="true" />
              {t(`spotlights.${kind}`)}
            </p>
            <Link to={`/template/${template.id}`} className="mt-1.5 block">
              <h3 className={`line-clamp-2 font-extrabold leading-snug text-ink hover:underline ${compact ? 'text-sm' : 'text-base'}`}>
                {template.title}
              </h3>
            </Link>
          </div>
          <span className="shrink-0 rounded-full border border-line-soft bg-surface-glass px-2 py-1 text-[10px] font-bold text-ink-soft">
            {formatHashtags(template.hashtags) || t('spotlights.general')}
          </span>
        </div>

        <div className={`mt-3 flex flex-wrap content-start gap-1.5 ${compact ? 'min-h-7' : 'min-h-8'}`}>
          {template.template_items?.slice(0, compact ? 2 : 3).map((templateItem, index) => (
            <span
              key={`${templateItem.item_id}-${index}`}
              className={`${compact ? 'max-w-[7.5rem]' : 'max-w-[9rem]'} truncate rounded-md border border-line-soft bg-item-card px-2 py-1 text-[11px] font-semibold text-item-card-text`}
            >
              {templateItem.item?.name || templateItem.item_id}
            </span>
          ))}
          {template.item_count > (compact ? 2 : 3) && (
            <span className="rounded-md border border-line-soft px-2 py-1 text-[11px] font-semibold text-muted">
              +{template.item_count - (compact ? 2 : 3)}
            </span>
          )}
        </div>

        <div className={`${compact ? 'mt-3 pt-2.5' : 'mt-4 pt-3'} flex items-center justify-between gap-2 border-t border-line-soft`}>
          <div className="min-w-0 space-y-1 text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <Users size={13} aria-hidden="true" />
              {t('spotlights.rankedBy', { count: formatCount(template.use_count) })}
            </span>
            <span className="flex items-center gap-1.5" aria-live="off">
              <Clock3 size={13} aria-hidden="true" />
              {t('spotlights.refreshesIn', { time: formatCountdown(prompt.ends_at, t), tick })}
            </span>
          </div>
          <button
            type="button"
            data-auth-next={`/rank?template=${encodeURIComponent(template.id)}`}
            onClick={() => onUse(template)}
            className={`group flex shrink-0 items-center gap-1 rounded-full bg-brand text-canvas font-extrabold shadow-sm transition-all hover:bg-brand-accent active:scale-95 ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3.5 py-2 text-xs'}`}
          >
            {t('spotlights.rankNow')}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FeaturedPrompts({ compact = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const toast = useToast();
  const [spotlights, setSpotlights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [refreshKey, setRefreshKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // M1: refreshKey เป็นแค่ตัว retrigger — ไม่ส่งเป็น ?cycle เพื่อให้ URL ตรงกับ
    // FreshnessHub แล้ว inFlightGET รวมเหลือ 1 request (backend cacheKey ตัด query ทิ้งอยู่แล้ว)
    fetchSpotlights().then((result) => {
      if (cancelled) return;
      setSpotlights(result?.data || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    const handleRefresh = () => setRefreshKey(Date.now());
    window.addEventListener('tog-refresh-feed', handleRefresh);
    return () => window.removeEventListener('tog-refresh-feed', handleRefresh);
  }, []);

  useEffect(() => {
    const rolloverTimes = [spotlights?.daily?.ends_at, spotlights?.weekly?.ends_at]
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    if (rolloverTimes.length === 0) return undefined;

    const nextRollover = Math.min(...rolloverTimes);
    const remaining = nextRollover - Date.now();
    const delay = remaining > 0
      ? Math.min(remaining + 1000, 2147483647)
      : 60000;
    const timer = window.setTimeout(() => setRefreshKey(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [spotlights]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const useTemplate = (template) => {
    const next = `/rank?template=${encodeURIComponent(template.id)}`;
    if (!currentUser) {
      toast.warning(t('discover.protectedLogin'));
      navigate(loginPath(next));
      return;
    }
    navigate(next);
  };

  if (!loading && !spotlights?.daily?.template && !spotlights?.weekly?.template) return null;

  return (
    <section aria-labelledby={compact ? 'spotlights-heading-compact' : 'spotlights-heading'}>
      <div className={`${compact ? 'mb-2' : 'mb-3'} flex items-end justify-between gap-4 px-1`}>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted">
            {t('spotlights.eyebrow')}
          </p>
          <h2 id={compact ? 'spotlights-heading-compact' : 'spotlights-heading'} className={`${compact ? 'text-base' : 'text-lg'} mt-0.5 font-black text-ink`}>
            {t('spotlights.title')}
          </h2>
        </div>
        <p className="hidden max-w-64 text-right text-xs font-medium text-muted sm:block lg:hidden">
          {t('spotlights.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={t('spotlights.loading')}>
          {[0, 1].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-2xl border border-line-soft bg-surface/60" />
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
          <PromptCard kind="daily" prompt={spotlights?.daily} tick={tick} onUse={useTemplate} compact={compact} />
          <PromptCard kind="weekly" prompt={spotlights?.weekly} tick={tick} onUse={useTemplate} compact={compact} />
        </div>
      )}
    </section>
  );
}

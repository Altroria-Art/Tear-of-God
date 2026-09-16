import { Activity, Heart, ListPlus, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { timeAgo } from '../../lib/format';

function eventDetails(event, t) {
  if (event.type === 'liked_ranking') {
    return { Icon: Heart, iconClass: 'text-vote-up', label: t('feed.activityLiked') };
  }
  if (event.type === 'template_used') {
    return { Icon: LayoutTemplate, iconClass: 'text-highlight', label: t('feed.activityUsedTemplate') };
  }
  return { Icon: ListPlus, iconClass: 'text-brand', label: t('feed.activityCreatedRanking') };
}

function ActivityAvatar({ actor }) {
  return actor?.avatar_url ? (
    <img src={actor.avatar_url} alt="" className="h-9 w-9 rounded-full border border-line-soft object-cover" loading="lazy" />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-soft bg-surface-glass text-sm font-black text-muted">
      {actor?.username?.charAt(0)?.toUpperCase() || 'U'}
    </span>
  );
}

export default function ActivityFeed({ events = [], loading = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (loading && events.length === 0) {
    return (
      <section className="rounded-2xl border border-line-soft bg-surface p-4 shadow-sm" aria-labelledby="following-activity-title">
        <div className="flex items-center gap-2">
          <Activity size={17} className="text-highlight" />
          <h2 id="following-activity-title" className="text-sm font-black text-ink">{t('feed.activityTitle')}</h2>
        </div>
        <p className="mt-4 animate-pulse text-center text-xs font-medium text-muted">{t('feed.activityLoading')}</p>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-sm" aria-labelledby="following-activity-title">
      <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3 sm:px-5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-highlight/10 text-highlight">
          <Activity size={17} />
        </span>
        <div className="min-w-0">
          <h2 id="following-activity-title" className="text-sm font-black text-ink">{t('feed.activityTitle')}</h2>
          <p className="text-[11px] font-medium text-muted">{t('feed.activitySubtitle')}</p>
        </div>
      </div>

      <div className="divide-y divide-line-soft">
        {events.slice(0, 12).map((event) => {
          const { Icon, iconClass, label } = eventDetails(event, t);
          const targetPath = event.type === 'template_used' && event.template?.id
            ? '/template/' + encodeURIComponent(event.template.id)
            : '/post/' + encodeURIComponent(event.ranking?.id || '');
          const targetTitle = event.type === 'template_used'
            ? event.template?.title || event.ranking?.title
            : event.ranking?.title;
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => navigate(targetPath)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-glass sm:px-5"
            >
              <ActivityAvatar actor={event.actor} />
              <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-glass ' + iconClass} aria-hidden="true">
                <Icon size={14} fill={event.type === 'liked_ranking' ? 'currentColor' : 'none'} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-ink">
                  {label.replace('{{name}}', event.actor?.username || t('common.unknownUser'))}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted" title={targetTitle || ''}>
                  {targetTitle || t('common.unknownItem')}
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-medium text-muted">{timeAgo(event.occurred_at)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

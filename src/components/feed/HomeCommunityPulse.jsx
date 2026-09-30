import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function PulseSection({ title, className, children }) {
  return <section className={className}>
    <h3 className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">{title}</h3>
    <div className="mt-1.5 divide-y divide-line-soft">{children}</div>
  </section>;
}

function PulseItem({ href, title, context, detail }) {
  return <Link to={href} className="group block min-w-0 py-2 first:pt-1 last:pb-1">
    <span className="block break-words text-[13px] font-bold leading-snug text-ink transition-colors group-hover:text-brand">{title}</span>
    {(context || detail) && <span className="mt-0.5 block min-w-0 break-words text-[11px] leading-snug text-muted">
      {[context, detail].filter(Boolean).join(' · ')}
    </span>}
  </Link>;
}

export default function HomeCommunityPulse({ pulse }) {
  const { t } = useTranslation();
  const rankings = (pulse?.rankings || []).filter(item => item.id && item.title).slice(0, 2);
  const rankingIds = new Set(rankings.map(item => item.id));
  const discussions = (pulse?.discussions || []).filter(item => item.id && item.title && !rankingIds.has(item.id)).slice(0, 2);
  const template = (pulse?.templates || []).find(item => item.id && item.title);
  const topics = !rankings.length && !discussions.length && !template
    ? (pulse?.topics || []).filter(item => item.href && item.label).slice(0, 2) : [];
  if (!rankings.length && !discussions.length && !template && !topics.length) return null;

  const rankingDetail = item => [
    item.new_ranking ? t('homeDiscovery.newRanking') : null,
    item.comments > 0 ? t('homeDiscovery.comments', { count: item.comments }) : null,
    item.reactions > 0 ? t('homeDiscovery.reactions', { count: item.reactions }) : null,
  ].filter(Boolean).join(' · ');

  return <section aria-labelledby="home-pulse-heading" className="home-pulse-rail rounded-2xl border border-line-soft bg-surface p-4 text-ink">
    <h2 id="home-pulse-heading" className="text-xs font-black uppercase tracking-[0.12em] text-ink">{t('homeDiscovery.communityPulse')}</h2>
    {rankings.length > 0 && <PulseSection title={t('homeDiscovery.activeNow')} className="mt-4">
      {rankings.map(item => <PulseItem key={item.id} href={`/post/${encodeURIComponent(item.id)}`}
        title={item.title} context={item.author_name ? `@${item.author_name}` : item.template_title} detail={rankingDetail(item)} />)}
    </PulseSection>}
    {discussions.length > 0 && <PulseSection title={t('homeDiscovery.discussions')} className="mt-3 border-t border-line-soft pt-3">
      {discussions.map(item => <PulseItem key={item.id} href={`/post/${encodeURIComponent(item.id)}`}
        title={item.title} context={item.author_name ? `@${item.author_name}` : item.template_title}
        detail={item.comments > 0 ? t('homeDiscovery.comments', { count: item.comments }) : null} />)}
    </PulseSection>}
    {template && <PulseSection title={t('homeDiscovery.templateInPlay')} className="mt-3 border-t border-line-soft pt-3">
      <PulseItem href={`/template/${encodeURIComponent(template.id)}`} title={template.title}
        context={template.creator_name ? `@${template.creator_name}` : null}
        detail={t('homeDiscovery.activeRankings', { count: template.active_rankings || 0 })} />
    </PulseSection>}
    {topics.length > 0 && <PulseSection title={t('homeDiscovery.topicFallback')} className="mt-4">
      {topics.map(item => <PulseItem key={item.key || item.href} href={item.href} title={item.label} />)}
    </PulseSection>}
    {pulse.sampled && <p className="mt-3 text-[11px] leading-snug text-muted">{t('pulse.sampleNote')}</p>}
    <Link to="/discover" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-ink transition-colors hover:text-brand">
      {t('homeDiscovery.exploreMore')} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  </section>;
}

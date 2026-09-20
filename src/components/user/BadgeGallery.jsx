import { Award, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BadgeGallery({ badges }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {badges.map(badge => (
        <article key={badge.id} className={`rounded-xl border p-4 ${badge.unlocked ? 'border-brand/30 bg-brand/5' : 'border-line-soft bg-surface'}`}>
          <div className="flex items-start gap-3">
            <span className={`rounded-xl p-2 shrink-0 ${badge.unlocked ? 'bg-brand/10 text-brand' : 'bg-canvas text-muted'}`}>
              {badge.unlocked ? <Award size={22} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-ink">{t(`profile.badge.${badge.id}`)}</h4>
              <p className={`mt-1 text-xs font-semibold ${badge.unlocked ? 'text-brand' : 'text-muted'}`}>
                {t(badge.unlocked ? 'profile.badgeUnlocked' : 'profile.badgeLocked')}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-ink-soft">{t('profile.badgeRequirement')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t(`profile.badgeDesc.${badge.id}`)}</p>
          {badge.progress !== null && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-muted">{t('profile.badgeProgress', { current: badge.progress, total: badge.need })}</p>
              <progress value={badge.progress} max={badge.need}
                aria-label={t(`profile.badge.${badge.id}`)}
                className="block w-full h-2 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-canvas [&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:bg-brand" />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

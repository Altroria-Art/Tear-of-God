import { Award, Lock, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BadgeGallery({
  badges = [],
  equippedBadgeId = null,
  _equippedBadgeMeta = null,
  canEquip = false,
  onEquip,
  onUnequip,
  isEquipping = false,
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {badges.map((badge) => {
        const isEquipped = equippedBadgeId === badge.id;
        const badgeTitle = badge.hashtag
          ? `${t(`profile.badge.${badge.id}`)} · ${badge.hashtag}`
          : t(`profile.badge.${badge.id}`);

        return (
          <article
            key={badge.id}
            className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
              isEquipped
                ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/30'
                : badge.unlocked
                  ? 'border-brand/30 bg-brand/5'
                  : 'border-line-soft bg-surface'
            }`}
          >
            <div>
              <div className="flex items-start gap-3">
                <span
                  className={`rounded-xl p-2 shrink-0 ${
                    isEquipped
                      ? 'bg-amber-500/15 text-amber-500'
                      : badge.unlocked
                        ? 'bg-brand/10 text-brand'
                        : 'bg-canvas text-muted'
                  }`}
                >
                  {badge.unlocked ? <Award size={22} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-ink">{badgeTitle}</h4>
                    {isEquipped && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Check size={10} strokeWidth={3} />
                        {t('profile.equippedBadge')}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      isEquipped
                        ? 'text-amber-600 dark:text-amber-400'
                        : badge.unlocked
                          ? 'text-brand'
                          : 'text-muted'
                    }`}
                  >
                    {t(badge.unlocked ? 'profile.badgeUnlocked' : 'profile.badgeLocked')}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs font-bold text-ink-soft">{t('profile.badgeRequirement')}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {t(`profile.badgeDesc.${badge.id}`, { hashtag: badge.hashtag || t('profile.hashtags') })}
              </p>

              {badge.progress !== null && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-muted">
                    {t('profile.badgeProgress', { current: badge.progress, total: badge.need })}
                    {badge.hashtag ? ` (${badge.hashtag})` : ''}
                  </p>
                  <progress
                    value={badge.progress}
                    max={badge.need}
                    aria-label={badgeTitle}
                    className="block w-full h-2 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-canvas [&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:bg-brand"
                  />
                </div>
              )}
            </div>

            {/* Equip actions — only rendered when canEquip is true and badge is unlocked */}
            {canEquip && badge.unlocked && (
              <div className="mt-4 pt-3 border-t border-line-soft/60 flex items-center justify-end gap-2">
                {isEquipped ? (
                  <button
                    type="button"
                    disabled={isEquipping}
                    onClick={() => onUnequip?.()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-soft hover:text-ink bg-surface border border-line-soft hover:bg-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('profile.unequipBadge')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isEquipping}
                    onClick={() => onEquip?.(badge.id, badge.hashtag ? { hashtag: badge.hashtag } : null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-canvas bg-brand hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    {t('profile.equipBadge')}
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

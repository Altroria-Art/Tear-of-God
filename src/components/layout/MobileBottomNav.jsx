import { Compass, Home, PlusCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';
import { primaryNavigation, navigationIsActive, usesEditorNavigation } from '../../lib/primaryNavigation';

const icons = { home: Home, discover: Compass, create: PlusCircle, profile: User };

export default function MobileBottomNav() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const location = useLocation();
  const hidden = usesEditorNavigation(location.pathname);

  if (hidden) return null;

  return (
    <>
      <div className="h-20 lg:hidden" aria-hidden="true" />
      <nav
        aria-label={t('nav.mobileNavigation')}
        className="bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-line-soft bg-canvas px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {primaryNavigation(currentUser).map(item => {
            const { to, icon, label, prominent } = item;
            const Icon = icons[icon];
            const active = navigationIsActive(location.pathname, item, currentUser);

            return (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  if (to === '/' && location.pathname === '/') {
                    window.dispatchEvent(new CustomEvent('tog-refresh-feed'));
                  }
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${
                  active ? 'text-brand' : 'text-muted hover:bg-surface-glass hover:text-ink'
                }`}
              >
                <span className={prominent ? 'mobile-rank-action grid h-9 w-11 place-items-center bg-acid text-acid-ink' : ''}>
                  <Icon size={20} strokeWidth={active || prominent ? 2.5 : 2} />
                </span>
                <span className="max-w-full text-center leading-tight">{t(label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

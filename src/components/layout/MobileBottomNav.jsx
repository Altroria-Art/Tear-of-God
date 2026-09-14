import { Bookmark, Compass, Home, PlusCircle } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const items = [
  { to: '/', icon: Home, label: 'nav.home', exact: true },
  { to: '/discover', icon: Compass, label: 'nav.discover' },
  { to: '/create', icon: PlusCircle, label: 'nav.create', prominent: true },
  { to: '/discover?view=saved', icon: Bookmark, label: 'discover.savedTemplates', saved: true },
];

export default function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const hidden = ['/login', '/forgot-password', '/reset-password', '/create', '/rank', '/admin']
    .some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  if (hidden) return null;

  const savedView = location.pathname === '/discover'
    && new URLSearchParams(location.search).get('view') === 'saved';

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav
        aria-label={t('nav.mobileNavigation')}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line-soft bg-canvas/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {items.map(({ to, icon: Icon, label, exact, prominent, saved }) => {
            const active = saved
              ? savedView
              : exact
                ? location.pathname === '/'
                : location.pathname.startsWith(to) && !(to === '/discover' && savedView);

            return (
              <NavLink
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${
                  active ? 'text-brand' : 'text-muted hover:bg-surface-glass hover:text-ink'
                }`}
              >
                <span className={prominent ? 'grid h-8 w-11 place-items-center rounded-full bg-brand text-canvas shadow-sm' : ''}>
                  <Icon size={prominent ? 21 : 20} strokeWidth={active || prominent ? 2.5 : 2} fill={saved && active ? 'currentColor' : 'none'} />
                </span>
                <span className="max-w-20 truncate">{t(label)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}

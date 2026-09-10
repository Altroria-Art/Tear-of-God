import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Compass, Sparkles, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';

const NAV_LINKS = [
  { icon: LayoutDashboard, labelKey: 'sidebar.home', path: '/' },
  { icon: Compass, labelKey: 'sidebar.discover', path: '/discover' },
  { icon: Sparkles, labelKey: 'sidebar.createTierList', path: '/create' },
];

export default function HomeLeftSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentUser } = useUser();

  return (
    <div className="space-y-5 text-ink">
      {/* Quick Nav */}
      <div className="bg-surface border border-line-soft rounded-2xl p-3.5 shadow-sm">
        <ul className="space-y-1">
          {NAV_LINKS.map((item, idx) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <li key={idx}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-semibold text-[14px] ${
                    isActive
                      ? 'bg-brand text-canvas font-bold shadow-xs'
                      : 'text-ink-soft hover:bg-surface-glass hover:text-ink'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-canvas' : 'text-brand'} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* User Card or Create CTA Card */}
      {currentUser ? (
        <div className="bg-surface border border-line-soft rounded-2xl p-4 shadow-sm space-y-3.5">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="w-11 h-11 rounded-full overflow-hidden bg-surface-glass border border-line-soft shrink-0 hover:opacity-80 transition-opacity"
            >
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-muted text-sm">
                  {currentUser.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/profile" className="block text-[14px] font-bold text-ink truncate hover:underline">
                {currentUser.username}
              </Link>
              <Link to="/profile" className="text-[12px] text-muted hover:text-brand transition-colors font-medium">
                {t('sidebar.viewProfile')}
              </Link>
            </div>
          </div>

          <Link
            to="/create"
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 rounded-xl bg-brand text-canvas text-xs font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            <PlusCircle size={15} />
            <span>{t('sidebar.createTierList')}</span>
          </Link>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-surface to-surface-glass border border-line-soft rounded-2xl p-4.5 shadow-sm space-y-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-ink leading-snug">{t('sidebar.joinCtaTitle')}</h4>
            <p className="text-[12px] text-muted mt-1 leading-relaxed">{t('sidebar.joinCtaDesc')}</p>
          </div>
          <Link
            to="/create"
            className="w-full py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand text-canvas text-xs font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            <span>{t('sidebar.startRanking')}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
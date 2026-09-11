import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Sparkles, PlusCircle, Home, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';



export default function HomeLeftSidebar() {
  const { t } = useTranslation();

  const { currentUser } = useUser();

  return (
    <div className="space-y-5 text-ink">
      <div className="flex flex-col gap-1">
        <Link to="/" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-glass text-[15px] font-bold transition-colors">
          <Home size={20} /> {t('nav.home')}
        </Link>
        <Link to="/create" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-glass text-[15px] font-bold transition-colors">
          <PlusCircle size={20} /> {t('nav.create')}
        </Link>
        <Link to="/discover" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-glass text-[15px] font-bold transition-colors">
          <Compass size={20} /> {t('nav.discover')}
        </Link>
        <Link to="/discover?view=saved" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-glass text-[15px] font-bold transition-colors mt-2 border-t border-line-soft pt-4">
          <Bookmark size={20} /> {t('discover.savedTemplates')}
        </Link>
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
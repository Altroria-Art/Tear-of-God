import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, PlusCircle, Home, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';



export default function HomeLeftSidebar() {
  const { t } = useTranslation();

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

    </div>
  );
}

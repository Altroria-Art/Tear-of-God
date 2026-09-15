import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HomeLeftSidebar() {
  const { t } = useTranslation();

  return (
    <div className="text-ink">
      <Link
        to="/discover?view=saved"
        className="group flex items-center justify-between p-3.5 rounded-2xl border border-line-soft bg-surface/80 hover:bg-surface hover:border-brand/40 shadow-xs transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-brand group-hover:text-canvas transition-all">
            <Bookmark size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-ink group-hover:text-brand transition-colors truncate">
              {t('discover.savedTemplates')}
            </p>
            <p className="text-[11px] text-muted truncate">
              {t('sidebar.savedHint')}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
      </Link>
    </div>
  );
}

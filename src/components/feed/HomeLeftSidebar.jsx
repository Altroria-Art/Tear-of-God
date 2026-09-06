import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Compass, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NAV_LINKS = [
  { icon: LayoutDashboard, labelKey: 'sidebar.home', path: '/' },
  { icon: Compass, labelKey: 'sidebar.discover', path: '/discover' },
  { icon: Sparkles, labelKey: 'sidebar.createTierList', path: '/create' },
];

export default function HomeLeftSidebar() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-ink">

      {/* Quick Nav */}
      <div className="bg-surface border border-line-soft rounded-2xl p-4 shadow-sm">
        <ul className="space-y-1">
          {NAV_LINKS.map((item, idx) => (
            <li key={idx}>
              <Link to={item.path} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-glass hover:text-highlight transition-colors font-semibold text-[15px]">
                <item.icon size={20} className="text-brand" />
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
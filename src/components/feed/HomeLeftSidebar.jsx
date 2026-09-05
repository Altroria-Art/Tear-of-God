import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Compass, Sparkles } from 'lucide-react';
import { fetchCategories } from '../../lib/api';
import { getCategoryStyle, CATEGORY_DEFAULT } from '../../lib/categories';
import { useTranslation } from 'react-i18next';

const NAV_LINKS = [
  { icon: LayoutDashboard, labelKey: 'sidebar.home', path: '/' },
  { icon: Compass, labelKey: 'sidebar.discover', path: '/discover' },
  { icon: Sparkles, labelKey: 'sidebar.createTierList', path: '/create' },
];

// Fallback hardcoded if DB is empty
const DEFAULT_CATEGORIES = [
  { category: 'music' },
  { category: 'movie' },
  { category: 'food' },
  { category: 'game' },
  { category: 'anime' },
];

export default function HomeLeftSidebar() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories({ limit: 5 }).then(res => {
      if (res && res.length > 0) {
        setCategories(res);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    }).catch(() => {
      setCategories(DEFAULT_CATEGORIES);
    });
  }, []);

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

      {/* Categories */}
      <div className="bg-surface border border-line-soft rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 px-1">{t('sidebar.popularCategories')}</h3>
        
        <ul className="space-y-1">
          {categories.map((cat, idx) => {
            const { icon: IconComp, color } = getCategoryStyle(cat.category, { ...CATEGORY_DEFAULT, color: 'text-brand' });
            // Capitalize first letter for display
            const displayLabel = cat.category.charAt(0).toUpperCase() + cat.category.slice(1);
            
            return (
              <li key={idx}>
                <Link to={`/category/${encodeURIComponent(cat.category)}`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-glass transition-colors text-[14.5px] font-medium text-ink-soft hover:text-ink">
                  <IconComp size={18} className={color} />
                  {displayLabel}
                </Link>
              </li>
            );
          })}
        </ul>
        
        <Link to="/discover" className="block mt-4 text-center text-[13px] font-bold text-brand hover:text-highlight transition-colors">
          {t('sidebar.showAllCategories')}
        </Link>
      </div>
    </div>
  );
}


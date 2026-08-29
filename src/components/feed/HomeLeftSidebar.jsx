import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Compass, Sparkles, Music, Film, Utensils, Gamepad2, Tv, MonitorPlay, Hash, Folder, BookOpen, Dumbbell, Palette, Laptop, Plane } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { fetchCategories } from '../../lib/api';

const NAV_LINKS = [
  { icon: LayoutDashboard, label: 'Home', path: '/' },
  { icon: Compass, label: 'Discover', path: '/discover' },
  { icon: Sparkles, label: 'Create Tier List', path: '/create' },
];

const getIconForCategory = (catStr) => {
  if (!catStr) return { icon: Folder, color: 'text-gray-400' };
  const t = catStr.toLowerCase();
  if (t.includes('music') || t.includes('song') || t.includes('เพลง')) return { icon: Music, color: 'text-rose-500' };
  if (t.includes('movie') || t.includes('film') || t.includes('หนัง')) return { icon: Film, color: 'text-amber-500' };
  if (t.includes('food') || t.includes('eat') || t.includes('อาหาร')) return { icon: Utensils, color: 'text-orange-500' };
  if (t.includes('game') || t.includes('play') || t.includes('เกม')) return { icon: Gamepad2, color: 'text-blue-500' };
  if (t.includes('anime') || t.includes('manga') || t.includes('อนิเมะ')) return { icon: Tv, color: 'text-purple-500' };
  if (t.includes('series') || t.includes('drama') || t.includes('ซีรีส์')) return { icon: MonitorPlay, color: 'text-indigo-500' };
  if (t.includes('learn') || t.includes('book') || t.includes('study') || t.includes('เรียน') || t.includes('หนังสือ')) return { icon: BookOpen, color: 'text-teal-500' };
  if (t.includes('sport') || t.includes('fitness') || t.includes('กีฬา')) return { icon: Dumbbell, color: 'text-emerald-500' };
  if (t.includes('art') || t.includes('draw') || t.includes('ศิลปะ')) return { icon: Palette, color: 'text-pink-500' };
  if (t.includes('tech') || t.includes('code') || t.includes('it') || t.includes('คอม')) return { icon: Laptop, color: 'text-cyan-500' };
  if (t.includes('travel') || t.includes('trip') || t.includes('เที่ยว')) return { icon: Plane, color: 'text-sky-500' };
  return { icon: Folder, color: 'text-brand' }; // Default
};

// Fallback hardcoded if DB is empty
const DEFAULT_CATEGORIES = [
  { category: 'music' },
  { category: 'movie' },
  { category: 'food' },
  { category: 'game' },
  { category: 'anime' },
];

export default function HomeLeftSidebar() {
  const { currentUser } = useUser();
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
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Categories */}
      <div className="bg-surface border border-line-soft rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 px-1">Popular Categories</h3>
        
        <ul className="space-y-1">
          {categories.map((cat, idx) => {
            const { icon: IconComp, color } = getIconForCategory(cat.category);
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
          Show all categories
        </Link>
      </div>
    </div>
  );
}


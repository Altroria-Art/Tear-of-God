import { Music, Film, Utensils, Gamepad2, Tv, MonitorPlay, Folder, BookOpen, Dumbbell, Palette, Laptop, Plane, Hash } from 'lucide-react';

// Context-aware icon + color for categories/hashtags. Was copy-pasted into
// HomeLeftSidebar (getIconForCategory) and HomeRightSidebar (getIconForTag) —
// keep in ONE place so both sidebars agree.
export const CATEGORY_DEFAULT = { icon: Folder, color: 'text-gray-400' };
export const HASHTAG_DEFAULT = { icon: Hash, color: 'text-muted' };

export function getCategoryStyle(raw, fallback = CATEGORY_DEFAULT) {
  if (!raw) return fallback;
  const t = raw.toLowerCase();
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
  return fallback;
}
// Generate a consistent pastel color based on a string (item name or id)
export function getItemColor(str) {
  if (!str) return 'var(--color-surface-glass)';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  
  // Returns a vivid jewel tone in Dark Mode, and a bright pastel in Light Mode.
  return `hsl(${hue}, var(--item-bg-s), var(--item-bg-l))`;
}

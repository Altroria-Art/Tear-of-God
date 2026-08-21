// Shared display formatters — was previously copy-pasted into
// TemplateCard.jsx / Discover.jsx (formatCount) and stuck unexported inside
// HomeFeed.jsx (timeAgo, capped at "days ago").

export function formatCount(n) {
  const num = n || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return `${num}`;
}

export function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const seconds = Math.round((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

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
  
  const date = new Date(dateString);
  const dateFormatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const seconds = Math.round((new Date() - date) / 1000);
  
  let relative = '';
  if (seconds < 60) relative = `${seconds} seconds ago`;
  else {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) relative = `${minutes} minutes ago`;
    else {
      const hours = Math.round(minutes / 60);
      if (hours < 24) relative = `${hours} hours ago`;
      else {
        const days = Math.round(hours / 24);
        if (days < 7) relative = `${days} days ago`;
        else {
          const weeks = Math.round(days / 7);
          if (weeks < 5) relative = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
          else {
            const months = Math.round(days / 30);
            if (months < 12) relative = `${months} month${months > 1 ? 's' : ''} ago`;
            else {
              const years = Math.round(days / 365);
              relative = `${years} year${years > 1 ? 's' : ''} ago`;
            }
          }
        }
      }
    }
  }
  
  return `${dateFormatted} • ${relative}`;
}

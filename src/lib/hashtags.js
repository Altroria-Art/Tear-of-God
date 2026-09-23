// Parse hashtags from various stored formats (CSV, JSON string, space-separated, array)
// into an array of clean, unique hashtags formatted with '#' prefix: ['#SERIES', '#FANTASY']
export function parseHashtags(value) {
  if (!value) return [];
  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = trimmed.slice(1, -1).split(',');
      }
    } else if (trimmed.includes(',')) {
      list = trimmed.split(',');
    } else if (trimmed.includes('#')) {
      list = trimmed.split(/\s+/);
    } else {
      list = [trimmed];
    }
  }
  const cleanTags = list
    .map((tag) => String(tag || '').trim().replace(/^#+/, '').trim())
    .filter(Boolean);
  return [...new Set(cleanTags)].map((tag) => '#' + tag);
}

// Shared display normalization for stored comma-separated hashtags.
export function formatHashtags(value) {
  return parseHashtags(value).join(' ');
}

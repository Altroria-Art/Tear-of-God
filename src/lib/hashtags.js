// Shared display normalization for stored comma-separated hashtags.
export function formatHashtags(value) {
  return [...new Set(String(value || '').split(',').map(tag => tag.trim().replace(/^#+/, '').trim()).filter(Boolean))]
    .map(tag => '#' + tag).join(' ');
}

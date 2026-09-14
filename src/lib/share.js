export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function shareUrl(path) {
  return `${window.location.origin}${path}`;
}

export function challengePath(templateId, sourceRankingId) {
  const params = new URLSearchParams({ template: templateId });
  if (sourceRankingId) params.set('challenge', sourceRankingId);
  return `/rank?${params.toString()}`;
}

export function challengeUrl(templateId, sourceRankingId) {
  return shareUrl(challengePath(templateId, sourceRankingId));
}

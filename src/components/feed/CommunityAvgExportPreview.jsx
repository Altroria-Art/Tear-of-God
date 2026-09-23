import ExportCard from '../ui/ExportCard';

/**
 * Backwards-compatibility wrapper for Community Average export preview.
 * Delegates directly to ExportCard so layout, geometry, tier rows, and item boxes
 * are 100% identical to Home Feed ranking exports.
 */
export default function CommunityAvgExportPreview({
  title,
  authorName,
  authorAvatar,
  postedAt,
  updatedText,
  hashtags,
  tiers = [],
  theme = 'light',
  shareLink = null,
  shareFormat = 'landscape',
  shareCta = 'Rank it and compare your taste',
  shareQrHint = 'Scan to open this list',
  typeBadge = 'Community Average',
}) {
  const normalizedTiers = (tiers || []).map((t, idx) => ({
    tier: t.tier ?? t.label,
    color: t.color,
    index: t.index ?? idx,
    items: (t.items || []).map((it) => (
      typeof it === 'object'
        ? { name: it.name || it.title || '', image_url: it.image_url || it.image || null }
        : { name: String(it), image_url: null }
    )),
  }));

  return (
    <ExportCard
      title={title}
      authorName={authorName}
      authorAvatar={authorAvatar}
      postedAt={postedAt || updatedText}
      hashtags={hashtags}
      tiers={normalizedTiers}
      theme={theme}
      shareLink={shareLink}
      shareFormat={shareFormat}
      shareCta={shareCta}
      shareQrHint={shareQrHint}
      typeBadge={typeBadge}
    />
  );
}

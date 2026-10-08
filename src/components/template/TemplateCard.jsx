import BookmarkButton from './BookmarkButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ListOrdered, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shareUrl } from '../../lib/share';
import ShareExportModal from '../ui/ShareExportModal';
import Avatar from '../ui/Avatar';
import { normalizeTopicItemPreview, normalizeTemplatePreview } from '../../lib/templatePreview';
import TierLabel from '../tier/TierLabel';
import { useTranslation } from 'react-i18next';
import HashtagList from './HashtagList';

function PreviewItemBox({ item }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(item.imageUrl && !imgError);

  return (
    <span
      className="relative min-w-0 min-h-16 rounded-lg bg-item-card text-item-card-text border border-line-soft p-1 flex flex-col items-center justify-center text-center overflow-hidden select-none"
      title={item.name}
    >
      {hasImage && (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-10 w-10 object-cover rounded pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      )}
        <span className="w-full line-clamp-2 text-[10px] font-bold leading-[1.1] text-ink text-center break-words px-0.5">
          {item.name}
        </span>
    </span>
  );
}

export default function TemplateCard({ template, onUse, inSavedView = false, featured = false, compact = false }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const previewRef = useRef(null);
  const [previewRowCount, setPreviewRowCount] = useState(2);
  useEffect(() => {
    if (!compact || !previewRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      // Rows occupy 46px plus a 6px gap; contentRect excludes padding.
      setPreviewRowCount(Math.max(1, Math.min(4, Math.floor((entry.contentRect.height + 6) / 52))));
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [compact]);
  const preview = useMemo(() => normalizeTopicItemPreview(template), [template]);

  const detailHref = `/template/${template.id}`;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  if (compact) {
    const rankedPreview = template.ranking_preview;
    const previewTemplate = rankedPreview ? { ...template, template_items: rankedPreview.items } : template;
    const hasAssignedItems = previewTemplate.template_items?.some(item => item.tier);
    const tierPreview = hasAssignedItems ? normalizeTemplatePreview(previewTemplate, { maxTiers: template.tiers?.length || 0, maxItemsPerTier: previewRowCount * 2 }) : null;
    const filledTiers = (tierPreview?.rows || []).map((row, index) => {
      const count = (rankedPreview?.counts || template.preview_item_counts)?.find(item => item.tier === row.label)?.count;
      return { ...row, index, overflow: count == null ? row.overflow : Math.max(0, count - row.items.length) };
    }).filter(row => row.items.length > 0);
    const populatedRows = filledTiers.length === 1
      ? Array.from({ length: Math.min(previewRowCount, Math.ceil(filledTiers[0].items.length / 2)) }, (_, index) => ({
        ...filledTiers[0], key: `${filledTiers[0].key}-${index}`, items: filledTiers[0].items.slice(index * 2, index * 2 + 2),
        overflow: index === Math.min(previewRowCount, Math.ceil(filledTiers[0].items.length / 2)) - 1 ? filledTiers[0].overflow : 0,
      }))
      : filledTiers.slice(0, previewRowCount).map(row => ({ ...row, items: row.items.slice(0, 2), overflow: row.overflow + Math.max(0, row.items.length - 2) }));
    const gridItems = preview.rows.flat().slice(0, previewRowCount * 2);
    const gridRows = Array.from({ length: Math.ceil(gridItems.length / 2) }, (_, index) => gridItems.slice(index * 2, index * 2 + 2));
    const gridOverflow = Math.max(0, (template.item_count ?? preview.totalCount) - gridItems.length);
    const omittedTierCount = filledTiers.slice(previewRowCount).reduce((sum, row) => sum + row.items.length + row.overflow, 0);
    if (filledTiers.length > 1 && populatedRows.length && omittedTierCount) populatedRows[populatedRows.length - 1].overflow += omittedTierCount;
    const creatorId = template.profile?.id || template.creator_id || template.user_id || template.creator?.id;
    const creator = <><Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" style={{ width: 24, height: 24 }} /><span className="truncate text-xs text-muted">@{template.profile?.username || t('common.unknownUser')}</span></>;
    return <div className="discover-topic-card aspect-square flex flex-col overflow-hidden border border-line-soft bg-surface min-w-0">
      <Link ref={previewRef} to={detailHref} className="discover-card-preview relative flex-1 min-h-0 flex flex-col justify-center bg-canvas/40 py-2 px-2.5 gap-1.5 border-b border-line-soft overflow-hidden">
        {populatedRows.length > 0 ? populatedRows.map(row => <div key={row.key} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-surface/75 border border-line-soft/60 px-1.5 py-1 min-h-[46px]">
          <TierLabel label={row.label} color={row.color} index={row.index} className="w-9 h-9 min-h-9 overflow-hidden rounded-lg text-[10px] font-black shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            {row.items.map(item => <span key={item.key} title={item.name} className="flex items-center justify-center w-9 h-9 shrink-0 rounded-md border border-line-soft bg-surface p-1 text-[10px] font-semibold text-ink text-center overflow-hidden"><span className="line-clamp-2 break-words leading-tight">{item.name}</span></span>)}
            {row.overflow > 0 && <span className="shrink-0 rounded border border-line-soft bg-surface px-1.5 py-1 text-[10px] font-bold text-muted" title={t('social.moreItems', { count: row.overflow })}>+{row.overflow}</span>}
          </div>
        </div>) : gridRows.length ? gridRows.map((items, index) => <div key={index} className="flex shrink-0 gap-1.5 rounded-xl bg-surface/75 border border-line-soft/60 px-1.5 py-1 min-h-[46px]">
          {items.map(item => <span key={item.key} title={item.name} className="flex items-center justify-center w-9 h-9 rounded-md border border-line-soft bg-surface p-1 text-[10px] font-semibold text-ink text-center overflow-hidden"><span className="line-clamp-2 break-words leading-tight">{item.name}</span></span>)}
          {index === gridRows.length - 1 && gridOverflow > 0 && <span className="shrink-0 rounded border border-line-soft bg-surface px-1.5 py-1 text-[10px] font-bold text-muted" title={t('social.moreItems', { count: gridOverflow })}>+{gridOverflow}</span>}
        </div>) : <span className="text-xs text-muted">{t('template.noItems', 'No items')}</span>}
      </Link>
      <div className="discover-card-content p-2.5 flex flex-col shrink-0 gap-1">
        <Link to={detailHref} title={template.title} className="discover-card-title text-sm font-bold text-ink line-clamp-2 leading-[18px] min-h-9 hover:text-brand">{template.title}</Link>
        <HashtagList hashtags={template.hashtags} singleLine maxTags={2} overflowHref={detailHref} />
        <div className="flex items-center justify-between gap-2 min-w-0">
          {creatorId ? <Link to={`/profile/${encodeURIComponent(creatorId)}`} className="flex items-center gap-1.5 min-w-0 hover:underline">{creator}</Link> : <div className="flex items-center gap-1.5 min-w-0">{creator}</div>}
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted" title={t('social.rankingCount', { count: Number(template.use_count) || 0 })}><ListOrdered size={12} />{Number(template.use_count) || 0}</span>
        </div>
          <div className="flex items-center gap-1 pt-1.5 border-t border-line-soft/40">
            <button type="button" onClick={() => onUse?.(template)} className="play-button flex-1 min-w-0 px-2 text-[11px]">{t('template.use')}</button>
            <BookmarkButton template={template} inSavedView={inSavedView} />
            <button type="button" onClick={handleShare} aria-label={t('common.share')} title={t('common.share')} className="min-h-11 min-w-11 grid place-items-center rounded-lg border border-line-soft text-muted hover:text-ink"><Share2 size={16} /></button>
          </div>
      </div>
      <ShareExportModal open={shareOpen} mode="share" onClose={() => setShareOpen(false)} link={shareUrl(detailHref)} />
    </div>;
  }

  return (
    <div className={`social-card overflow-hidden flex flex-col ${compact ? 'template-card--compact' : ''} ${featured ? 'template-card--featured xl:col-span-2' : ''}`}>
      <Link to={detailHref} className="template-card-preview bg-surface-glass p-4 pt-10 flex flex-col relative">
        {template.use_count > 0 && <div className="template-card-metrics absolute top-2 right-2 bg-surface px-2 py-1 rounded text-xs text-brand flex items-center gap-2 z-10 shadow-xs">
          {template.use_count > 0 && <span className="flex items-center gap-1" title={t('common.uses')}>
            <ListOrdered size={14} /> {t('social.rankingCount', { count: Number(template.use_count) })}
          </span>}
        </div>}

        <p className="text-xs font-bold text-muted">{t('social.previewItems', { count: preview.rows.flat().length })}</p>
        <div className="topic-items-preview grid grid-cols-4 gap-2 mt-2" aria-label={t('social.itemPreview')}>
          {preview.rows.flat().map(item => <PreviewItemBox key={item.key} item={item} />)}
          {preview.totalCount === 0 && <p className="col-span-4 py-4 text-sm text-muted">{t('template.noItems', 'No items')}</p>}
        </div>
        {preview.overflow > 0 && <p className="mt-2 text-xs text-muted">{t('social.moreItems', { count: preview.overflow })}</p>}
      </Link>
      <div className="template-card-content p-4 flex-grow flex flex-col justify-between bg-surface/50 border-t border-line-soft">
        <div>
          <Link to={detailHref}>
            <h3 className="text-base font-bold leading-6 text-ink mb-2 line-clamp-2 min-h-12 hover:underline">{template.title}</h3>
          </Link>
          {compact && <HashtagList hashtags={template.hashtags} className="mb-2" />}
          {(() => {
            const creatorId = template.profile?.id || template.creator_id || template.user_id || template.creator?.id;
            const username = template.profile?.username || t('common.unknownUser');
            return creatorId ? (
              <Link
                to={`/profile/${encodeURIComponent(creatorId)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 mb-4 group cursor-pointer max-w-full"
              >
                <Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" />
                <span className="text-sm text-muted group-hover:text-ink group-hover:underline transition-colors truncate">
                  @{username}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 mb-4 max-w-full">
                <Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" />
                <span className="text-sm text-muted truncate">@{username}</span>
              </div>
            );
          })()}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onUse?.(template)}
            className="play-button flex-1 min-w-24"
          >
            {t('template.use')}
          </button>
          <BookmarkButton template={template} inSavedView={inSavedView} />
          <button
            type="button"
            onClick={handleShare}
            aria-label={t('common.share')}
            title={t('common.share')}
            className="min-h-11 min-w-11 shrink-0 px-3 py-2.5 text-muted hover:text-ink transition-colors rounded-lg border border-line-soft hover:bg-surface"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <ShareExportModal
        open={shareOpen}
        mode="share"
        onClose={() => setShareOpen(false)}
        link={shareUrl(detailHref)}
      />
    </div>
  );
}

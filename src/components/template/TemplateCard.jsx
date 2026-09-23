import BookmarkButton from './BookmarkButton';
import { useMemo, useState } from 'react';
import { Users, Eye, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shareUrl } from '../../lib/share';
import ShareExportModal from '../ui/ShareExportModal';
import Avatar from '../ui/Avatar';
import { formatCount } from '../../lib/format';
import TierLabel from '../tier/TierLabel';
import { normalizePreviewRows } from '../../lib/templatePreview';
import { useTranslation } from 'react-i18next';

function PreviewItemBox({ item }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(item.imageUrl && !imgError);

  return (
    <span
      className="relative aspect-square w-8 h-8 shrink-0 rounded-md bg-item-card text-item-card-text backdrop-blur-md border border-line-soft p-0.5 flex items-center justify-center text-center overflow-hidden select-none shadow-2xs"
      title={item.name}
    >
      {hasImage ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover rounded-sm pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="w-full line-clamp-2 text-[8px] font-bold leading-[1.1] text-ink text-center break-words px-0.5">
          {item.name}
        </span>
      )}
    </span>
  );
}

export default function TemplateCard({ template, onUse, inSavedView = false }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const preview = useMemo(() => normalizePreviewRows(template), [template]);

  const detailHref = `/template/${template.id}`;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  return (
    <div className="glass rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link to={detailHref} className="bg-surface-glass p-3 pt-9 h-36 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-2 right-2 bg-surface px-2 py-1 rounded text-xs text-brand flex items-center gap-2 z-10 shadow-xs">
          <span className="flex items-center gap-1" title={t('common.uses')}>
            <Users size={14} /> {formatCount(template.use_count)}
          </span>
          <span className="flex items-center gap-1" title={t('common.views')}>
            <Eye size={14} /> {formatCount(template.view_count)}
          </span>
        </div>

        {preview.mode === 'grid' ? (
          <div className="w-full h-full rounded-lg border border-line-soft bg-surface/40 flex flex-col justify-center gap-2 p-2 overflow-hidden">
            {preview.totalCount === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted/60 select-none">
                {t('template.noItems', 'No items')}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-1.5 min-w-0">
                  {preview.rows[0].map((item) => (
                    <PreviewItemBox key={item.key} item={item} />
                  ))}
                </div>
                {(preview.rows[1].length > 0 || preview.overflow > 0) && (
                  <div className="flex items-center justify-center gap-1.5 min-w-0">
                    {preview.rows[1].map((item) => (
                      <PreviewItemBox key={item.key} item={item} />
                    ))}
                    {preview.overflow > 0 && (
                      <span
                        className="aspect-square w-8 h-8 shrink-0 rounded-md border border-line-soft bg-surface/80 text-ink-soft font-bold text-[10px] flex items-center justify-center select-none shadow-2xs"
                        title={`+${preview.overflow}`}
                      >
                        +{preview.overflow}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col justify-center gap-2">
            {preview.rows.map((row) => (
              <div
                key={row.key}
                className="flex h-11 min-h-0 w-full rounded-lg border border-line-soft bg-surface/40 overflow-hidden items-stretch"
              >
                <TierLabel
                  label={row.label}
                  color={row.color}
                  className={`w-14 h-full max-h-full min-h-0 shrink-0 border-r border-line-soft/40 font-bold px-1 select-none flex items-center justify-center text-center overflow-hidden ${
                    row.label.length > 2
                      ? 'text-[10px] leading-tight break-words line-clamp-2 truncate'
                      : 'text-sm'
                  }`}
                />
                <div className="flex-1 min-w-0 h-full flex items-center gap-1.5 px-2 overflow-hidden bg-surface/30">
                  {row.items.map((item) => (
                    <PreviewItemBox key={item.key} item={item} />
                  ))}
                  {row.overflow > 0 && (
                    <span
                      className="aspect-square w-8 h-8 shrink-0 rounded-md border border-line-soft bg-surface/80 text-ink-soft font-bold text-[10px] flex items-center justify-center select-none shadow-2xs"
                      title={`+${row.overflow}`}
                    >
                      +{row.overflow}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Link>
      <div className="p-4 flex-grow flex flex-col justify-between bg-surface/50 border-t border-line-soft">
        <div>
          <Link to={detailHref}>
            <h3 className="text-base font-bold leading-6 text-ink mb-2 line-clamp-2 min-h-12 hover:underline">{template.title}</h3>
          </Link>
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
            className="flex-1 min-w-24 py-2.5 bg-brand hover:bg-brand-accent text-canvas text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {t('template.use')}
          </button>
          <BookmarkButton template={template} inSavedView={inSavedView} />
          <button
            type="button"
            onClick={handleShare}
            aria-label={t('common.share')}
            title={t('common.share')}
            className="shrink-0 px-3 py-2.5 text-muted hover:text-ink transition-colors rounded-lg border border-line-soft hover:bg-surface"
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

import BookmarkButton from './BookmarkButton';
import { useMemo, useState } from 'react';
import { ListOrdered, Eye, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shareUrl } from '../../lib/share';
import ShareExportModal from '../ui/ShareExportModal';
import Avatar from '../ui/Avatar';
import { formatCount } from '../../lib/format';
import { normalizeTopicItemPreview } from '../../lib/templatePreview';
import { useTranslation } from 'react-i18next';

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

export default function TemplateCard({ template, onUse, inSavedView = false, featured = false }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const preview = useMemo(() => normalizeTopicItemPreview(template), [template]);

  const detailHref = `/template/${template.id}`;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  return (
    <div className={`social-card overflow-hidden flex flex-col ${featured ? 'template-card--featured xl:col-span-2' : ''}`}>
      <Link to={detailHref} className="template-card-preview bg-surface-glass p-4 pt-10 flex flex-col relative">
        {(template.use_count > 0 || template.view_count > 0) && <div className="template-card-metrics absolute top-2 right-2 bg-surface px-2 py-1 rounded text-xs text-brand flex items-center gap-2 z-10 shadow-xs">
          {template.use_count > 0 && <span className="flex items-center gap-1" title={t('common.uses')}>
            <ListOrdered size={14} /> {t('social.rankingCount', { count: Number(template.use_count) })}
          </span>}
          {template.view_count > 0 && <span className="flex items-center gap-1" title={t('common.views')}>
            <Eye size={14} /> {formatCount(template.view_count)}
          </span>}
        </div>}

        <p className="text-xs font-bold text-muted">{t('social.previewItems', { count: preview.rows.flat().length })}</p>
        <div className="topic-items-preview grid grid-cols-4 gap-2 mt-2" aria-label={t('social.itemPreview')}>
          {preview.rows.flat().map(item => <PreviewItemBox key={item.key} item={item} />)}
          {preview.totalCount === 0 && <p className="col-span-4 py-4 text-sm text-muted">{t('template.noItems', 'No items')}</p>}
        </div>
        {preview.overflow > 0 && <p className="mt-2 text-xs text-muted">{t('social.moreItems', { count: preview.overflow })}</p>}
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

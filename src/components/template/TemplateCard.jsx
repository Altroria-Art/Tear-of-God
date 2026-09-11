import BookmarkButton from './BookmarkButton';
import { useMemo, useState } from 'react';
import { Users, Eye, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shareUrl } from '../../lib/share';
import ShareExportModal from '../ui/ShareExportModal';
import Avatar from '../ui/Avatar';
import { formatCount } from '../../lib/format';
import TierLabel from '../tier/TierLabel';
import { useTranslation } from 'react-i18next';

export default function TemplateCard({ template, onUse }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const tiersMap = useMemo(() => {
    const map = {};
    template.template_items?.forEach((ti) => {
      if (!ti.tier) return;
      if (!map[ti.tier]) map[ti.tier] = [];
      map[ti.tier].push(ti.item?.name || ti.item_id);
    });
    return map;
  }, [template.template_items]);

  const previewTiers = (template.tiers || []).slice(0, 2);
  const detailHref = `/template/${template.id}`;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  return (
    <div className="glass rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link to={detailHref} className="bg-surface-glass p-3 pt-9 h-36 flex flex-col gap-2 relative">
        <div className="absolute top-2 right-2 bg-surface px-2 py-1 rounded text-xs text-brand flex items-center gap-2 z-10 shadow-xs">
          <span className="flex items-center gap-1" title={t('common.uses')}>
            <Users size={14} /> {formatCount(template.use_count)}
          </span>
          <span className="flex items-center gap-1" title={t('common.views')}>
            <Eye size={14} /> {formatCount(template.view_count)}
          </span>
        </div>

        {Object.keys(tiersMap).length === 0 && template.template_items?.length > 0 ? (
          <div className="flex-1 bg-surface rounded flex flex-col items-center justify-center gap-2 p-2 overflow-hidden border border-line-soft">
            <span className="text-xs font-semibold text-ink-soft">
              {template.template_items.length} items
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {template.template_items.slice(0, 6).map((ti, idx) => (
                <span key={idx} className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft shadow-sm rounded-lg px-2 py-0.5 text-[10px] whitespace-nowrap">
                  {ti.item?.name || ti.item_id}
                </span>
              ))}
            </div>
          </div>
        ) : (
          previewTiers.map((tier) => {
            const items = tiersMap[tier.label];
            if (!items) return null;
            return (
              <div key={tier.id ?? tier.label} className="flex min-h-0 flex-1 gap-2">
                <TierLabel
                  label={tier.label}
                  color={tier.color}
                  className={`w-12 rounded-l font-bold px-1 ${tier.label.length > 2 ? 'text-[9px]' : 'text-sm'}`}
                />
                <div className="bg-surface min-w-0 flex-grow rounded-r opacity-80 flex items-center gap-2 px-2 overflow-hidden border-y border-r border-line-soft">
                  {items.slice(0, 2).map((item, idx) => (
                    <span key={idx} className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium rounded-lg px-2 py-1 text-xs truncate min-w-0">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Link>
      <div className="p-4 flex-grow flex flex-col justify-between bg-surface/50 border-t border-line-soft">
        <div>
          <Link to={detailHref}>
            <h3 className="text-base font-bold leading-6 text-ink mb-2 line-clamp-2 min-h-12 hover:underline">{template.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" />
            <span className="text-sm text-muted">@{template.profile?.username || t('common.unknownUser')}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onUse?.(template)}
            className="flex-1 min-w-24 py-2.5 bg-brand hover:bg-brand-accent text-canvas text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {t('template.use')}
          </button>
          <BookmarkButton template={template} />
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













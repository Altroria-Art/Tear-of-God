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
      // เก็บ object item ทั้งตัว (มี image_url ด้วย) — ตัว render ข้างล่างจัดการทั้งแบบมี/ไม่มีรูป
      map[ti.tier].push(ti.item || { id: ti.item_id, name: ti.item_id, image_url: null });
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
      <Link to={detailHref} className="bg-surface-glass p-4 h-40 flex flex-col gap-2 relative">
        <div className="absolute top-2 right-2 bg-surface px-2 py-1 rounded text-xs text-brand flex items-center gap-2 z-10 shadow-xs">
          <span className="flex items-center gap-1" title={t('common.uses')}>
            <Users size={14} /> {formatCount(template.use_count)}
          </span>
          <span className="flex items-center gap-1" title={t('common.views')}>
            <Eye size={14} /> {formatCount(template.view_count)}
          </span>
        </div>

        {previewTiers.map((tier) => {
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
                {items.slice(0, 2).map((item, idx) => {
                  const name = item?.name || item?.id || '';
                  return item?.image_url ? (
                    <span key={idx} className="relative shrink-0 w-12 h-9 rounded-md overflow-hidden border border-line-soft shadow-md">
                      <img src={item.image_url} alt={name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    </span>
                  ) : (
                    <span key={idx} className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg px-2 py-1 text-[10px] whitespace-nowrap">
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Link>
      <div className="p-4 flex-grow flex flex-col justify-between bg-surface/50 border-t border-line-soft">
        <div>
          <Link to={detailHref}>
            <h3 className="text-lg font-bold text-ink mb-2 line-clamp-1 hover:underline">{template.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" />
            <span className="text-sm text-muted">@{template.profile?.username || t('common.unknownUser')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onUse?.(template)}
            className="flex-1 py-2.5 bg-brand-accent hover:bg-surface text-canvas font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
          >
            {t('template.use')}
          </button>
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













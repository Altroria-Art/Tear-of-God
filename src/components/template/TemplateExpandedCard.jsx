import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ListOrdered, Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Avatar from '../ui/Avatar';
import BookmarkButton from './BookmarkButton';
import TierRow from '../feed/TierRow';
import { buildTierRows } from '../../lib/tiers';
import { buildDiscoverCommunityBoard } from '../../lib/discoverCommunityBoard';
import { formatCount } from '../../lib/format';
import { shareUrl } from '../../lib/share';
import ShareExportModal from '../ui/ShareExportModal';

export default function TemplateExpandedCard({ template, onUse, inSavedView = false }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);

  const creatorId = template.profile?.id || template.creator_id || template.creator?.id;
  const username = template.profile?.username || t('common.unknownUser');
  const hashtags = template.hashtags
    ? template.hashtags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  const boardData = template.board ? buildDiscoverCommunityBoard(template.board) : null;
  const hasCommunity = Boolean(boardData && template.board?.participant_count > 0);

  const tierRows = hasCommunity
    ? boardData.rows
    : buildTierRows(template.template_items, template.tiers);

  const unrankedItems = hasCommunity
    ? boardData.unranked
    : (template.template_items || []).filter((item) => !item.tier);

  const totalItemCount = hasCommunity
    ? boardData.itemCount
    : (template.item_count ?? template.template_items?.length ?? 0);

  const templateUses = Number(template.use_count) || 0;
  const participantCount = Number(template.board?.participant_count) || 0;
  const detailHref = `/template/${encodeURIComponent(template.id)}`;

  return (
    <article className="social-card bg-surface border border-line-soft rounded-[20px] p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between h-full">
      {/* Top Header: Creator & Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {creatorId ? (
            <Link to={`/profile/${encodeURIComponent(creatorId)}`} className="shrink-0 group">
              <Avatar name={username} src={template.profile?.avatar_url} size="md" />
            </Link>
          ) : (
            <div className="shrink-0">
              <Avatar name={username} src={template.profile?.avatar_url} size="md" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {creatorId ? (
              <Link
                to={`/profile/${encodeURIComponent(creatorId)}`}
                className="font-bold text-ink hover:underline truncate block text-sm sm:text-base leading-tight"
              >
                @{username}
              </Link>
            ) : (
              <span className="font-bold text-ink truncate block text-sm sm:text-base leading-tight">
                @{username}
              </span>
            )}
            <span className="text-xs text-muted">
              {t('discover.boards.templateAuthor', 'Template Creator')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <BookmarkButton template={template} inSavedView={inSavedView} />
          <button
            type="button"
            onClick={() => onUse(template)}
            className="play-button px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
            title={t('template.use')}
          >
            <Copy size={13} strokeWidth={2.5} />
            <span>{t('template.use')}</span>
          </button>
        </div>
      </div>

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {hashtags.map((tag, idx) => {
            const clean = tag.replace(/^#/, '');
            return (
              <Link
                key={idx}
                to={`/discover/hashtag/${encodeURIComponent(clean)}`}
                className="px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider hover:border-line hover:shadow-xs transition-all flex items-center gap-0.5"
              >
                <span className="text-highlight">#</span>
                {clean}
              </Link>
            );
          })}
        </div>
      )}

      {/* Title & Description */}
      <div className="mb-4">
        {hasCommunity && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand/10 text-brand border border-brand/20 mb-2">
            <Users size={13} className="text-brand" />
            <span>{t('discover.boards.community')}</span>
            <span className="text-[11px] text-muted font-normal">
              • {t('discover.boards.people', { count: participantCount })}
            </span>
          </div>
        )}
        <Link to={detailHref}>
          <h2 className="text-lg sm:text-xl font-extrabold text-ink hover:text-highlight transition-colors mb-1.5">
            {template.title}
          </h2>
        </Link>
        {template.description && (
          <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
            {template.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {hasCommunity ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">
              <Users size={13} />
              {t('discover.boards.people', { count: participantCount })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-2.5 py-1 text-[11px] font-medium text-muted">
              {t('discover.boards.noRanking', 'No rankings yet')}
            </span>
          )}
          {templateUses > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-2.5 py-1 text-[11px] font-bold text-ink-soft">
              <ListOrdered size={13} className="text-brand" />
              {t('social.rankingCount', { count: formatCount(templateUses) })}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-2.5 py-1 text-[11px] font-bold text-ink-soft">
            <Users size={13} />
            {t('discover.boards.itemCount', { count: totalItemCount })}
          </span>
        </div>
      </div>

      {/* Tier Rows (Expanded view like Home feed) */}
      <div className="space-y-1.5 mb-4 flex-1">
        {tierRows.map((row) => (
          <TierRow
            key={row.tier}
            tier={row.tier}
            color={row.color}
            index={row.index}
            compact
            items={row.items.map((ri) => ({
              id: ri.id,
              name: ri.item?.name || ri.name || ri.item_id,
              image_url: ri.item?.image_url || ri.image_url,
            }))}
          />
        ))}
      </div>

      {/* Unranked items pool if any items have no tier assigned */}
      {unrankedItems.length > 0 && (
        <div className="mb-4 rounded-xl border border-line-soft bg-surface-glass p-3">
          <p className="text-xs font-bold text-muted mb-2">
            {hasCommunity
              ? t('discover.boards.unranked', 'No community ranking yet for these items')
              : t('discover.boards.unranked', 'Unranked Pool')}{' '}
            ({unrankedItems.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unrankedItems.slice(0, 16).map((item) => {
              const itemName = item.item?.name || item.name || item.item_id;
              return (
                <span
                  key={item.id}
                  className="px-2.5 py-1 rounded-lg border border-line-soft bg-surface text-xs font-semibold text-ink truncate max-w-[140px]"
                  title={itemName}
                >
                  {itemName}
                </span>
              );
            })}
            {unrankedItems.length > 16 && (
              <span className="px-2 py-1 text-xs font-bold text-muted">
                +{unrankedItems.length - 16}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer Tools */}
      <div className="flex items-center justify-between pt-3 border-t border-line-soft/60">
        <Link
          to={`${detailHref}/community`}
          className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition-colors"
        >
          <Users size={15} />
          <span>{t('discover.boards.community')}</span>
        </Link>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition-colors min-h-9 px-3 rounded-lg border border-line-soft hover:bg-surface"
        >
          <Share2 size={15} />
          <span>{t('common.share')}</span>
        </button>
      </div>

      <ShareExportModal
        open={shareOpen}
        mode="share"
        onClose={() => setShareOpen(false)}
        link={shareUrl(detailHref)}
      />
    </article>
  );
}

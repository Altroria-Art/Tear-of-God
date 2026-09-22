import { useState } from 'react';
import TierLabel from '../tier/TierLabel';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import { normalizeImageUrl } from '../../lib/images';

function TierItem({ item, idx, onClick, compact = false }) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  const itemName = typeof item === 'object' ? (item.name || item.title || item.item_id || t('common.unknownItem')) : (item || t('common.unknownItem'));
  const itemId = typeof item === 'object' ? (item.id ?? idx) : idx;
  const itemImg = typeof item === 'object' ? normalizeImageUrl(item.image_url || item.image) : null;

  return (
    <div
      key={itemId}
      onClick={(e) => { e.stopPropagation(); onClick(itemName); }}
      className={`group/item relative flex aspect-square shrink-0 items-center justify-center bg-item-card text-item-card-text backdrop-blur-md border border-line-soft/80 font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 rounded-xl text-center transition-all duration-200 select-none overflow-hidden cursor-pointer ${compact ? 'h-14 w-14 p-1' : 'h-18 w-18 sm:h-20 sm:w-20 p-1.5 sm:p-2'}`}
      title={itemName}
    >
      {(itemImg && !imgError) ? (
        <img
          src={itemImg}
          alt={itemName || 'item'}
          className="w-full h-full object-cover rounded-lg pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={`w-full line-clamp-3 font-semibold leading-tight text-center break-words select-none drop-shadow-xs px-0.5 ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}>
          {itemName}
        </span>
      )}
    </div>
  );
}

export default function TierRow({ tier, color, index, items = [], compact = false, itemLimit = null }) {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null);
  const isLong = (tier || '').length > 2;
  const isEmpty = items.length === 0;
  const visibleItems = Number.isInteger(itemLimit) ? items.slice(0, itemLimit) : items;
  const remainingItems = items.length - visibleItems.length;

  return (
    <>
      <div className={`flex items-stretch rounded-xl overflow-hidden ${isEmpty ? 'min-h-[44px]' : 'min-h-[54px]'} bg-tag border border-line-soft transition-colors`}>
        <TierLabel
          label={tier}
          color={color}
          index={index}
          className={`${compact ? 'w-12' : 'w-16 sm:w-18'} font-black shrink-0 ${isLong ? 'text-xs' : 'text-lg'} flex items-center justify-center`}
        />

        <div className={`${compact ? 'p-1.5 gap-1.5' : 'p-2 sm:p-2.5 gap-2'} flex ${compact && itemLimit ? 'flex-nowrap overflow-hidden' : 'flex-wrap'} items-center flex-grow min-w-0`}>
          {isEmpty ? (
            <span className="px-2 text-xs italic text-muted/50 font-medium select-none">
              {t('feed.emptyTier')}
            </span>
          ) : (
            <>
              {visibleItems.map((item, idx) => (
                <TierItem key={typeof item === 'object' ? (item.id ?? idx) : idx} item={item} idx={idx} onClick={setSelectedItem} compact={compact} />
              ))}
              {remainingItems > 0 && (
                <span className="grid h-10 min-w-10 place-items-center rounded-lg bg-surface-glass px-2 text-xs font-black text-ink-soft" aria-label={t('feed.moreItems', { count: remainingItems })}>
                  +{remainingItems}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} title={t('common.itemDetails', 'Item Details')}>
        <div className="text-center p-4">
          <p className="text-lg font-bold text-ink leading-relaxed break-words">{selectedItem}</p>
        </div>
      </Modal>
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeImageUrl } from '../../lib/images';
import useTouchItemDrag from '../../lib/useTouchItemDrag';

export default function EditorItem({ item, position, count, onMove, onShift, onDelete, onDragStart, onDragEnd }) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef(null);
  useTouchItemDrag(cardRef, Boolean(onDragStart), setDragging);

  useEffect(() => {
    setImgError(false);
  }, [item?.id, item?.image_url]);

  const itemImg = normalizeImageUrl(item?.image_url || item?.image);
  const hasValidImage = Boolean(itemImg && !imgError);
  const itemText = item?.content || item?.name || item?.title || t('common.unknownItem');

  const handleDragStart = (event) => {
    // The card is draggable, but its action buttons must remain reliable. Native
    // drag initiation from a nested button suppresses that button's click event
    // in some browsers, which made generated items appear non-interactive.
    if (event.target instanceof Element && event.target.closest('button:not(.editor-item-main)')) {
      event.preventDefault();
      return;
    }
    setDragging(true);
    onDragStart?.(event);
  };

  const stopDragStart = (event) => event.stopPropagation();

  return (
    <div
      ref={cardRef}
      data-item-id={item.id}
      draggable={Boolean(onDragStart)}
      onDragStart={handleDragStart}
      onDragEnd={event => { setDragging(false); onDragEnd?.(event); }}
      className={`editor-item ${dragging ? 'is-dragging' : ''} relative w-22 h-28 sm:w-24 sm:h-30 shrink-0 rounded-xl bg-item-card text-item-card-text border border-line-soft shadow-xs cursor-grab active:cursor-grabbing`}
    >
      <button
        type="button"
        draggable={false}
        onClick={onMove}
        title={itemText}
        aria-label={t('editor.moveNamedItem', { name: itemText })}
        className="editor-item-main w-full h-full px-1.5 pt-1.5 pb-11 rounded-xl text-center flex items-center justify-center overflow-hidden"
      >
        {hasValidImage ? (
          <img
            src={itemImg}
            alt={itemText}
            draggable={false}
            className="w-full h-full object-cover rounded-lg pointer-events-none"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="line-clamp-3 break-words text-[11px] sm:text-xs font-semibold leading-tight">
            {itemText}
          </span>
        )}
      </button>
      <div className="absolute inset-x-0 bottom-0 flex justify-between">
        <button
          type="button"
          onPointerDown={stopDragStart}
          onClick={() => onShift(-1)}
          disabled={position === 0}
          aria-label={t('rank.moveLeft')}
          className="w-11 h-11 grid place-items-center rounded-lg hover:bg-tag disabled:opacity-25"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onPointerDown={stopDragStart}
          onClick={() => onShift(1)}
          disabled={position === count - 1}
          aria-label={t('rank.moveRight')}
          className="w-11 h-11 grid place-items-center rounded-lg hover:bg-tag disabled:opacity-25"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      {onDelete && (
        <button
          type="button"
          onPointerDown={stopDragStart}
          onClick={onDelete}
          aria-label={t('editor.deleteItem', { name: itemText })}
          className="absolute -top-1 -right-1 z-10 flex h-11 w-11 items-start justify-end rounded-tr-xl p-1 text-muted hover:text-status-error"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full border border-line-soft bg-surface"><X size={13} /></span>
        </button>
      )}
    </div>
  );
}

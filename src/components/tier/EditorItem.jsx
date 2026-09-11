import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditorItem({ item, position, count, onMove, onShift, onDelete, onDragStart, onDragEnd }) {
  const { t } = useTranslation();
  return <div data-item-id={item.id} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className="relative w-18 h-22 sm:w-20 sm:h-24 shrink-0 rounded-xl bg-item-card text-item-card-text border border-line-soft shadow-xs cursor-grab active:cursor-grabbing">
    <button type="button" onClick={onMove} title={item.content} aria-label={t('editor.moveNamedItem', { name: item.content })} className="w-full h-full px-1.5 pt-1.5 pb-7 rounded-xl text-center">
      {item.image_url ? <img src={item.image_url} alt={item.content} draggable={false} className="w-full h-full object-cover rounded-lg pointer-events-none" /> : <span className="line-clamp-3 break-words text-[11px] sm:text-xs font-semibold leading-tight">{item.content}</span>}
    </button>
    <div className="absolute inset-x-0 bottom-0 flex justify-between">
      <button type="button" onClick={() => onShift(-1)} disabled={position === 0} aria-label={t('rank.moveLeft')} className="p-1.5 rounded-lg hover:bg-tag disabled:opacity-25"><ChevronLeft size={15} /></button>
      <button type="button" onClick={() => onShift(1)} disabled={position === count - 1} aria-label={t('rank.moveRight')} className="p-1.5 rounded-lg hover:bg-tag disabled:opacity-25"><ChevronRight size={15} /></button>
    </div>
    {onDelete && <button type="button" onClick={onDelete} aria-label={t('editor.deleteItem', { name: item.content })} className="absolute -top-2 -right-2 p-1 rounded-full bg-surface text-muted border border-line-soft hover:text-status-error"><X size={13} /></button>}
  </div>;
}

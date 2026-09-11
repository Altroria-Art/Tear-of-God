import TierLabel from '../tier/TierLabel';
import { useTranslation } from 'react-i18next';

export default function TierRow({ tier, color, index, items = [] }) {
  const { t } = useTranslation();
  return <div className="flex items-stretch rounded-xl overflow-hidden min-h-10 bg-tag border border-line-soft">
    <TierLabel label={tier} color={color} index={index} className={'w-14 sm:w-16 px-1 font-bold shrink-0 ' + (tier?.length > 2 ? 'text-xs' : 'text-lg')} />
    <div className="p-2 flex flex-wrap gap-2 items-center flex-1 min-w-0">
      {!items.length ? <span className="px-2 py-1 text-xs text-muted italic">{t('feed.emptyTier')}</span> : items.map((item, index) => {
        const name = typeof item === 'object' ? item.name || item.title || item.item_id : item;
        const src = typeof item === 'object' ? item.image_url || item.image : null;
        return <div key={item?.id ?? index} className={src ? 'w-16 rounded-lg bg-item-card border border-line-soft p-1' : 'readable-tier-item'} title={name}>
          {src ? <><img src={src} alt={name} loading="lazy" className="w-14 h-14 object-cover rounded-md" /><span className="block text-center text-[10px] leading-tight mt-1 break-words text-item-card-text">{name}</span></> : name || t('common.unknownItem')}
        </div>;
      })}
    </div>
  </div>;
}

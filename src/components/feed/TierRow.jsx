import TierLabel from '../tier/TierLabel'

export default function TierRow({ tier, color, index, items }) {
  return (
    <div className="flex rounded-xl overflow-hidden min-h-[50px] items-stretch bg-tag border border-line-soft ">
      <TierLabel label={tier} color={color} index={index} className="w-14 font-black text-lg" />

      <div className="p-2.5 flex flex-wrap gap-2 items-center flex-grow min-w-0">
        {items.map((item, index) => {
          const isObj = typeof item === 'object' && item !== null;
          const itemName = isObj ? (item.name || item.title) : item;
          const itemId = isObj ? item.id : index;
          const imageUrl = isObj ? (item.image_url || null) : null;

          return (
            <div
              key={itemId}
              className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center p-2 text-center text-[10px] md:text-xs overflow-hidden relative hover:scale-105 transition-transform duration-200 break-words"
            >
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt={itemName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  {itemName && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] leading-tight px-1 py-0.5 line-clamp-2 break-words">{itemName}</span>
                  )}
                </>
              ) : (
                /* จัดข้อความให้อยู่กึ่งกลางกล่องสี่เหลี่ยมพอดี */
                <span className="line-clamp-2 leading-normal drop-shadow-sm">{itemName}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}













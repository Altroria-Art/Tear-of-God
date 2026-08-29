import { TIER_STYLES } from '../../lib/tiers'

export default function TierRow({ tier, items }) {
  return (
    <div className="flex rounded-xl overflow-hidden min-h-[50px] items-center bg-tag border border-line-soft ">
      <div
        className={`w-14 self-stretch flex items-center justify-center font-black text-lg ${
          TIER_STYLES[tier] ?? 'bg-surface text-ink'
        }`}
      >
        {tier}
      </div>

      <div className="p-2.5 flex flex-wrap gap-2 items-center flex-grow">
        {items.map((item, index) => {
          const itemName = typeof item === 'object' ? (item.name || item.title) : item;
          const itemId = typeof item === 'object' ? item.id : index;

          return (
            <div
              key={itemId}
              className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center p-2 text-center text-[10px] md:text-xs hover:scale-105 transition-transform duration-200"
            >
              {/* จัดข้อความให้อยู่กึ่งกลางกล่องสี่เหลี่ยมพอดี */}
              <span className="line-clamp-2 leading-normal drop-shadow-sm">{itemName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}













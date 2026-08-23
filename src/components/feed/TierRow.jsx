import { TIER_STYLES } from '../../lib/tiers'

export default function TierRow({ tier, items }) {
  return (
    <div className="flex bg-white rounded-xl border border-line-soft overflow-hidden min-h-[50px] shadow-sm items-center">
      <div
        className={`w-14 self-stretch flex items-center justify-center font-black text-lg text-white ${
          TIER_STYLES[tier] ?? 'bg-muted'
        }`}
      >
        {tier}
      </div>

      <div className="p-2.5 flex flex-wrap gap-2 items-center flex-grow bg-white">
        {items.map((item, index) => {
          const itemName = typeof item === 'object' ? (item.name || item.title) : item;
          const itemId = typeof item === 'object' ? item.id : index;

          return (
            <div
              key={itemId}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-white p-2 text-center text-xs font-medium text-gray-700 shadow-sm"
            >
              {/* จัดข้อความให้อยู่กึ่งกลางกล่องสี่เหลี่ยมพอดี */}
              <span className="line-clamp-2 leading-normal">{itemName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
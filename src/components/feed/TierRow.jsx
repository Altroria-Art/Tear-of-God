import { TIER_STYLES } from '../../lib/tiers'

export default function TierRow({ tier, items }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface p-1.5">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white ${
          TIER_STYLES[tier] ?? 'bg-muted'
        }`}
      >
        {tier}
      </span>

      <div className="flex flex-wrap gap-2 items-center">
        {items.map((item, index) => {
          const itemName = typeof item === 'object' ? (item.name || item.title) : item;
          const itemId = typeof item === 'object' ? item.id : index;

          return (
            <div
              key={itemId}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-white p-2 text-center text-xs font-medium text-gray-700 shadow-sm"
            >
              {/* จัดข้อความให้อยู่กึ่งกลางกล่องสี่เหลี่ยมพอดี */}
              <span className="line-clamp-2 leading-tight">{itemName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
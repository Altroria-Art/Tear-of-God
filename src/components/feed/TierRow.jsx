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

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-lg border border-line-soft bg-surface px-3 py-1.5 text-sm text-item"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

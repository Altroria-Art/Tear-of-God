import { resolveTierColor, TIER_GLOW, TIER_LABEL_INK } from '../../lib/tiers'

// Shared tier badge. Color always comes from the tier's own `color` field
// (resolved via resolveTierColor), never from its display label — a tier
// named in Thai (or anything other than S/A/B/C/D) still renders its color.
// `index` is an optional last-resort fallback (position in the tier list)
// used only when there is neither a stored color nor a classic S/A/B/C/D
// label — e.g. a ranking with no template, so no color exists anywhere for
// it. Omit it when the caller has no meaningful position (e.g. a bare label
// string with no surrounding tier list) — resolveTierColor simply skips it.
//
// Deliberately carries NO font-size/font-weight in its own class list —
// callers pass those through `className` (each screen uses a different
// size). Putting a competing font-* utility here would be resolved by CSS
// source order, not by string order, and could silently lose to Tailwind's
// own stylesheet order.
export default function TierLabel({ label, color, index, className = '', fallbackClassName = 'bg-surface text-ink' }) {
  const bg = resolveTierColor(color, label, index)
  const glow = TIER_GLOW[label] ?? ''
  const base = 'flex shrink-0 items-center justify-center break-words text-center leading-tight drop-shadow-sm'

  if (bg) {
    return (
      <span
        style={{ backgroundColor: bg, color: TIER_LABEL_INK }}
        className={`${base} ${glow} ${className}`}
      >
        {label}
      </span>
    )
  }

  // No usable color — keep a neutral fallback appearance. Defaults to the
  // app's own theme tokens; callers rendering onto a fixed light/white
  // surface (e.g. ExportCard's PNG export) should override this via
  // fallbackClassName so the badge stays legible regardless of app theme.
  return (
    <span className={`${base} ${fallbackClassName} ${className}`}>
      {label}
    </span>
  )
}

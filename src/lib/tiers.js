// Tier labels are no longer fixed to S/A/B/C/D — templates can define custom
// tier names (including Thai text). Color must therefore come from the
// tier's own `color` field, never be looked up by its display label.
// See docs/tier-list-ui-fix-plan.md for the investigation behind this file.

// Canonical S/A/B/C/D palette — mirrors --color-tier-s..d in src/index.css.
// Used only as the final fallback when a tier has no usable `color` value
// and its label happens to be one of the five classic letters (keeps
// existing S/A/B/C/D tier lists pixel-identical to before this fix).
const CLASSIC_TIER_HEX = {
  S: '#ff7f7f',
  A: '#ffbf7f',
  B: '#ffff7f',
  C: '#7fff7f',
  D: '#7fbfff',
}

// Glow (the outer highlight on tier badges) is derived from the tier's own
// resolved color at runtime so the highlight always matches the header color —
// even after the user changes it in Create/Use-Template — instead of being
// pinned to the class keyed by the label (the old `tier-glow-s`… classes).
// `color-mix` keeps this working for any CSS color format the resolver can
// return (hex, rgb/hsl, even a `var()` reference). Same 20px blur / ~60%
// strength as the old CSS classes, but the hue now tracks the header.
export function tierGlowStyle(bg) {
  if (!bg) return ''
  return `0 0 20px color-mix(in srgb, ${bg} 60%, transparent)`
}

export const TIER_LABEL_INK = '#1a1a1a'

// Legacy shorthand colors that have been written into tiers JSON by older
// versions of the Create/RankTierList editors (Tailwind class names, not
// arbitrary values) — resolved to hex so they still render without relying
// on Tailwind having generated those exact utility classes.
const LEGACY_TIER_COLORS = {
  'bg-tier-s': '#ff7f7f',
  'bg-tier-a': '#ffbf7f',
  'bg-tier-b': '#ffff7f',
  'bg-tier-c': '#7fff7f',
  'bg-tier-d': '#7fbfff',
  'bg-red-400': '#f87171',
  'bg-orange-300': '#fdba74',
  'bg-amber-300': '#fcd34d',
  'bg-yellow-300': '#fde047',
  'bg-lime-400': '#a3e635',
  'bg-green-400': '#4ade80',
  'bg-emerald-400': '#34d399',
  'bg-teal-400': '#2dd4bf',
  'bg-cyan-400': '#22d3ee',
  'bg-blue-400': '#60a5fa',
  'bg-indigo-400': '#818cf8',
  'bg-purple-400': '#c084fc',
  'bg-fuchsia-400': '#e879f9',
  'bg-pink-400': '#f472b6',
  'bg-gray-400': '#9ca3af',
  'bg-gray-200': '#e5e7eb',
}

// Position-based fallback for tiers that have neither a usable `color` nor a
// classic S/A/B/C/D label (e.g. rankings with no template at all, so there is
// no color data stored anywhere for them) — same red→orange→yellow→green→blue
// progression as CLASSIC_TIER_HEX, cycling every 5 so any tier count is safe.
const TIER_FALLBACK_HEX = ['#ff7f7f', '#ffbf7f', '#ffff7f', '#7fff7f', '#7fbfff']

// Resolves a tier's stored `color` (whatever format it was saved in) plus
// its `label` (fallback for S/A/B/C/D) and optionally its `index` within the
// tier list (last-resort fallback when there is no color and no classic
// label) into a literal CSS color usable as an inline `backgroundColor`.
// Returns null only when none of color/label/index yield anything, so
// callers can fall back to a neutral style.
export function resolveTierColor(color, label, index) {
  if (typeof color === 'string' && color.trim()) {
    const trimmed = color.trim()

    // Tailwind arbitrary-value utility, e.g. "bg-[#ff7f7f]" — this is the
    // format every template currently stored in the database uses. Pull the
    // raw value out; it is applied as an inline style, not a className, so
    // it works whether or not Tailwind's scanner ever saw this exact string.
    const arbitraryMatch = trimmed.match(/^bg-\[(.+)\]$/)
    if (arbitraryMatch) return arbitraryMatch[1]

    // Known legacy Tailwind class name.
    if (LEGACY_TIER_COLORS[trimmed]) return LEGACY_TIER_COLORS[trimmed]

    // Already a raw CSS color.
    if (/^#|^rgb|^hsl|^var\(/.test(trimmed)) return trimmed
  }

  // No usable stored color — fall back to the classic palette if this is
  // genuinely one of the five fixed tiers (checked before index, since a
  // template can store its tiers out of S/A/B/C/D order — e.g. A,S,D — and
  // the label is the ground truth for what color that tier is meant to be).
  if (CLASSIC_TIER_HEX[label]) return CLASSIC_TIER_HEX[label]

  // Still nothing — cycle through the same palette by position, so a
  // template-less ranking with fully custom tier names (no color stored
  // anywhere) still gets a distinct, deterministic color per row instead of
  // every tier collapsing into the same neutral badge.
  if (Number.isInteger(index) && index >= 0) return TIER_FALLBACK_HEX[index % TIER_FALLBACK_HEX.length]

  return null
}

// Groups `ranking_items` rows into ordered, colored tier rows using a
// template's tier definition (`tiersDef`, e.g. from `template.tiers` or the
// `tiers` field GET /api/rankings now returns — see functions/api/rankings.js
// and docs/tier-list-feed-debug-plan.md). Shared by Home Feed and Post Detail
// so both render tiers in the same order/color as Discover Detailed instead
// of each guessing independently from ranking_items' insertion order.
//
// This deliberately does NOT do the following, each fixing a real bug found
// while tracing the feed data flow (see docs/tier-list-feed-debug-plan.md and
// docs/tier-list-empty-tier-and-publish-validation-plan.md):
//   - `ranking_items` whose `tier` is falsy (an unranked item) are skipped
//     entirely, never coerced into a fake tier (the old bug: `ri.tier || 'S'`).
//   - a tier label present in `ranking_items` but absent from `tiersDef`
//     (e.g. a ranking with no template at all) still gets its own row, using
//     its position among those "extra" rows as `index` for resolveTierColor's
//     fallback — items are never silently dropped.
//   - a tier defined in `tiersDef` never disappears just because it has zero
//     items — it keeps its row (label + color, empty container) so the full
//     tier structure authored on the Create/Use-Template page is preserved in
//     Feed, Post Detail and Profile (empty tiers were previously dropped here).
//
// Returns `[{ tier, color, index, items }]` where `items` are the *raw*
// matching `ranking_items` entries — callers are the ones who know what
// shape (plain string / {id,name} / …) their item renderer wants.
export function buildTierRows(rankingItems, tiersDef) {
  const itemsByLabel = {}
  ;(rankingItems || []).forEach((ri) => {
    if (!ri.tier) return // ยังไม่ได้จัด — ข้าม ไม่ยัดเข้า tier ไหนทั้งนั้น
    if (!itemsByLabel[ri.tier]) itemsByLabel[ri.tier] = []
    itemsByLabel[ri.tier].push(ri)
  })

  const rows = []
  const seen = new Set()

  ;(tiersDef || []).forEach((t, index) => {
    // tier ที่นิยามไว้แม้ไม่มีไอเทมเลยก็ต้องมีแถว (แสดงแถวเปล่า) — อย่า return ทิ้ง
    rows.push({ tier: t.label, color: t.color, index, items: itemsByLabel[t.label] || [] })
    seen.add(t.label)
  })

  Object.keys(itemsByLabel).forEach((label) => {
    if (seen.has(label)) return
    rows.push({ tier: label, color: undefined, index: rows.length, items: itemsByLabel[label] })
  })

  return rows
}

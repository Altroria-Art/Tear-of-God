# Tier List UI Fix Plan — Thai tier color loss & Discover Detailed row overlap

Status: **Implemented**. This document records the investigation, the fix, and verification for two
UI defects reported in the Tier List / Discover Detailed interfaces.

## 1. Problem Summary

1. **Tier color disappears with non-classic tier names.** In the Tier List editor (`/create`) and
   everywhere a tier is rendered, giving a tier a name other than `S`, `A`, `B`, `C`, or `D` (Thai text,
   or anything else) makes its color vanish.
2. **Discover Detailed rows overlap / look "crushed".** On a template's detail page
   (`/template/:templateId`), tier rows with wrapping content (long tier names, especially Thai) visually
   collide with adjacent rows instead of growing to fit their content.

## 2. Current Behavior (before the fix)

- Renaming a tier to Thai text (or any string other than S/A/B/C/D) removes its background color
  entirely — the badge renders with no color class at all.
- The color picker in the Create page's tier settings modal appeared to do nothing: picking a swatch
  never changed the visible tier color, for any tier including S/A/B/C/D.
- On `/template/:templateId`, a tier row whose label or item names wrap to more than one line overflows
  its fixed-height badge, spilling visually into the row above/below.

## 3. Evidence from the Existing Code

### Color

Every tier badge across the app resolved its color via `TIER_STYLES[tier.label]`
(`src/lib/tiers.js`), where `TIER_STYLES` only defines the keys `S A B C D`:

```js
export const TIER_STYLES = {
  S: 'bg-tier-s tier-glow-s text-[#1a1a1a] drop-shadow-sm',
  A: 'bg-tier-a tier-glow-a text-[#1a1a1a] drop-shadow-sm',
  B: 'bg-tier-b tier-glow-b text-[#1a1a1a] drop-shadow-sm',
  C: 'bg-tier-c tier-glow-c text-[#1a1a1a] drop-shadow-sm',
  D: 'bg-tier-d tier-glow-d text-[#1a1a1a] drop-shadow-sm',
}
```

Any other label produced `undefined`, which was interpolated into a `className` template literal as the
literal string `"undefined"` — i.e. no background class applied at all. Seven call sites did this:
`src/pages/Create.jsx`, `src/pages/TemplateDetailPage.jsx` (`TierListRow`),
`src/components/template/TemplateCard.jsx`, `src/pages/RankTierList.jsx`,
`src/components/feed/TierRow.jsx`, `src/pages/HomeFeed.jsx`, `src/components/ui/ExportCard.jsx`.

Meanwhile, every tier object already carries a `color` field end-to-end that was never read for
rendering: `Create.jsx`'s color picker → `updateTierData(id, 'color', …)` →
`tiers.map(({label, color}) => …)` on publish → the `templates.tiers` TEXT column in D1 →
`parseTiers()` in `functions/api/templates.js` → returned to the client → dropped. **The color picker
was a complete no-op**, even for the classic S/A/B/C/D tiers.

Querying `.d1-snapshot.sql` (production data) confirmed all 64 templates store colors as Tailwind
arbitrary-value strings, e.g.:

```json
[{"label":"S","color":"bg-[#ff7f7f]"}, ...]
[{"label":"โคตรโหด","color":"bg-[#ff7f7f]"},{"label":"ยาก","color":"bg-[#ffbf7f]"},{"label":"กำลังดี","color":"bg-[#ffff7f]"},{"label":"ง่ายไป","color":"bg-[#7fbfff]"}]
[{"label":"อร่อยเทพ","color":"bg-[#ff7f7f]"},{"label":"อร่อย","color":"bg-[#ffbf7f]"},{"label":"พอไหว","color":"bg-[#ffff7f]"},{"label":"ไม่รอด","color":"bg-[#7fbfff]"}]
```

Verifying the built stylesheet (`dist/assets/index-*.css`) showed these exact `bg-[#hex]` classes are
**not present** in the compiled CSS — Tailwind 4 only generates utilities it finds by scanning source
files, and these values exist only as database rows. Applying `tier.color` as a raw `className` would
therefore have rendered no color for 100% of existing templates; it must be applied as an inline style.

### Row overlap

`TierListRow` in `src/pages/TemplateDetailPage.jsx` used a fixed-height badge with no wrap handling:

```jsx
<div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm font-bold text-center leading-tight px-1 ...`}>
    {tier.label}
  </span>
  <div className="flex flex-wrap items-center gap-2">...</div>
</div>
```

- `h-12` is a hard 48px height. Content taller than that does not grow the box — because the row uses
  `items-center`, overflow spills symmetrically above and below, across the `border-b`, into the
  neighboring rows. This is the reported "rows overlap" symptom.
- No `overflow-wrap`/`break-words`. Thai has no inter-word spaces, so a single Thai tier name has zero
  natural line-break points and cannot wrap inside the ~40px content box — it overflows horizontally
  over the item pills instead.
- The items column had no `min-w-0`, so as a flex item it could not shrink below its min-content width,
  letting one long item name push the row wider than its container (which then clips it via
  `overflow-hidden` on the parent card).
- The item pills themselves also lacked `break-words`.

Simply increasing the fixed height would not have fixed this: a taller fixed height still overflows at
some label length, wastes space on the 62 of 64 templates using plain S/A/B/C/D, and does not address
the horizontal overflow case at all.

## 4. Root Cause Analysis

### Thai tier color issue

Root cause: **tier color was resolved by indexing a hardcoded 5-key map with the tier's display
label**, instead of reading the tier's own stored `color` field. This is a data-modeling bug, not a
CSS/localization issue — any tier named something other than `S/A/B/C/D` (Thai or otherwise) hit the
same failure. It was compounded by the fact that the `color` field, when read, was stored as a Tailwind
arbitrary-value string that the build process never generates a class for, so a naive "read tier.color"
fix would have also failed silently.

Architecturally, the display label was also being used as the cross-table join key
(`ranking_items.tier` / `template_items.tier` store the label string, and readers match on exact
string equality). No stable `id` was persisted for a tier — `Create.jsx` already keeps a `tier.id`
(`t1`…`t5`) during editing, but it was discarded on publish, keeping only `{label, color}`.

Checked against production data: **zero existing orphaned rows** today (5,132 `ranking_items` rows
linked to a template with tiers, all with tier labels matching their template's current tier set,
excluding intentional `NULL` tiers). This is a latent risk rather than an active bug — there is no
template-edit UI, and the remix flow (`RankTierList`) does not allow renaming tier labels. Migrating
`ranking_items`/`template_items` to a `tier_id` foreign key was assessed as a much larger, riskier
change than this defect required, so it was deferred (see §13).

### Discover Detailed row overlap issue

Root cause: the tier badge used a **fixed height (`h-12`) with `items-center` and no text-wrap
handling**, plus a sibling flex column with a `min-width: auto` default that could not shrink. Any
content taller than 48px or any single unbreakable word wider than ~40px overflowed the badge's
bounding box symmetrically into neighboring rows, rather than growing the row to contain it.

## 5. Relevant Files / Components

| File | Role |
|---|---|
| `src/lib/tiers.js` | Tier color resolution — previously label-keyed `TIER_STYLES` only; now also exports `resolveTierColor()` |
| `src/components/tier/TierLabel.jsx` | **New.** Shared tier badge component used by every tier-rendering call site |
| `src/pages/Create.jsx` | Tier List editor — color picker, tier bar, publish payload |
| `src/pages/TemplateDetailPage.jsx` | Discover Detailed page — `TierListRow`, the primary reported overlap bug |
| `src/components/template/TemplateCard.jsx` | Discover card preview (`/discover`, hashtag pages) |
| `src/pages/RankTierList.jsx` | Remix/rank canvas (`/rank?template=...`) |
| `src/components/feed/TierRow.jsx` | Home Feed / Post Detail tier preview rows |
| `src/pages/HomeFeed.jsx` | Home Feed card (duplicate of `TierRow`'s rendering, inline) |
| `src/components/ui/ExportCard.jsx` | PNG export preview (`html-to-image`) |
| `functions/api/templates.js` | Serializes/deserializes `templates.tiers` JSON — unchanged |
| `AGENTS.md` | Project conventions doc — updated to reflect the new rule |

## 6. Recommended Solution (implemented)

### Color: resolve from data, never from the label

Added `resolveTierColor(color, label)` to `src/lib/tiers.js`, which resolves a tier's stored `color` in
priority order:

1. `bg-[<value>]` (Tailwind arbitrary value, the format already in every production row) → extract
   `<value>` directly.
2. A known legacy Tailwind class name (`bg-tier-s`, `bg-red-400`, etc. — everything the Create/RankTierList
   editors have ever written) → mapped to its literal hex via `LEGACY_TIER_COLORS`.
3. Already a raw CSS color (`#...`, `rgb(`, `hsl(`, `var(`) → used as-is.
4. No usable color, but `label` is one of `S/A/B/C/D` → the canonical hex from the site's own
   `--color-tier-*` palette (`#ff7f7f #ffbf7f #ffff7f #7fff7f #7fbfff`), preserving today's exact
   appearance for the common case.
5. Otherwise → `null`, and the caller falls back to a neutral style.

The resolved value is applied as an **inline `style={{ backgroundColor }}`**, never as a Tailwind
class name — this is what makes it work for colors that only exist as database rows and were never
seen by Tailwind's build-time scanner.

`src/components/tier/TierLabel.jsx` is a new shared badge component wrapping this resolver, used at
every call site instead of each screen re-deriving a color independently. It intentionally carries no
font-size/font-weight of its own (callers pass those via `className`, since each screen sizes its badge
differently) and exposes a `fallbackClassName` prop for contexts (like the white PNG export card) that
must not use the app's dark-theme-aware default fallback style.

Tier identity was also made more robust: `Create.jsx` already tracks a stable `tier.id` while editing;
publishing now persists `{ id, label, color }` instead of dropping `id`. This is additive only — no
schema change, no migration, and every reader still falls back to matching on `label` when `id` is
absent (all pre-existing data).

### Row overlap: content-driven sizing, not a taller fixed height

`TierListRow`'s badge changed from `h-12` (fixed) to `min-h-12` (`TierLabel` applies this via its
caller's `className`) plus `break-words`, and the row's `items-center` became `items-stretch` so the
badge's height tracks its sibling column instead of overflowing past it. The items column gained
`min-w-0 flex-1` so it can shrink instead of forcing the row wider than its container, and item pills
gained `break-words`. The same `break-words`/`min-w-0` treatment was applied to the other tier-rendering
call sites (`TierRow`, `HomeFeed`, `TemplateCard`, `ExportCard`) for consistency, since they had the
same missing-wrap gap even where their `min-h-*` already made the row itself grow correctly.

This means: short content (S/A/B/C/D) stays exactly as compact as before; long/wrapping content grows
the row to fit, with no fixed ceiling and no wasted space on the common case.

## 7. Alternative Solutions Considered

- **Increase the fixed row height (e.g. `h-12` → `h-20`).** Rejected — still overflows at some label
  length, wastes vertical space on 62 of 64 existing templates, and does not address horizontal overflow
  from unbreakable Thai words at all.
- **Apply `tier.color` directly as a Tailwind class name.** Rejected — verified against the built CSS
  that none of the arbitrary-value classes stored in the database (`bg-[#ff7f7f]` etc.) are actually
  generated by Tailwind's scanner, since they exist only in database rows, not in source files scanned
  at build time. Every existing template would have rendered with no color.
  Note: `bg-[#hex]` also happens to already work correctly wherever a literal instance of that exact
  string exists in a `.jsx` source file today (verified via `src/pages/HashtagDetail.jsx`'s inline
  `bg-[#ffc329]`) — but that is incidental to a different literal, not something the database-driven
  tier colors can rely on.
- **Migrate `ranking_items.tier` / `template_items.tier` to a `tier_id` foreign key with a backfill.**
  This is the architecturally "complete" fix for the identity question, but requires a schema migration
  and backfilling production data; the audit found zero orphaned rows today, so this was deferred as a
  separate, larger piece of work rather than folded into this defect fix (see §13).
- **Per-page custom fix instead of a shared component.** Rejected — the same bug existed at 7 independent
  call sites; a shared `TierLabel` + `resolveTierColor()` prevents the same class of bug from
  reappearing at a future 8th call site.

## 8. Why the Recommended Solution is Safer

- Purely additive at the data level: no schema change, no D1 write, no migration. The only persisted
  change is an additional `id` key in `templates.tiers` JSON, which every existing reader already
  ignores gracefully (plain `JSON.parse` + destructuring of `label`/`color`).
- Backward-compatible by construction: `resolveTierColor()`'s priority order was built by enumerating
  every color format actually present in production data and prior code (`bg-[#hex]`, `bg-tier-*`,
  `bg-red-400`-style Tailwind swatches), so no existing template or draft changes appearance.
  `localStorage` drafts (`tog-create-draft`, versioned) need no migration or version bump for the same
  reason.
- Centralizing the fix in one resolver + one component means the 7 previous independent
  implementations collapse to 1, removing the "found on the 8th page" risk class entirely — including
  `ExportCard.jsx`'s own separate, third color mapping (`tierColor()`), which is now deleted.
- The row-height fix is content-driven (`min-h-*` + `break-words` + `min-w-0`) rather than a larger
  fixed number, so it cannot regress into the same bug class at a longer label length.

## 9. Expected UI Behavior After the Fix

- Renaming a tier to Thai text (or any string) in the Create editor keeps its color, whether that color
  is the default classic palette or a custom pick from the color swatch grid — which now visibly works
  for the first time.
- Every screen that renders a tier badge (Create, Discover Detailed, Discover cards, Rank/remix canvas,
  Home Feed, Post Detail, PNG export) shows the tier's actual stored color instead of a blank/undefined
  background for non-classic labels.
- Discover Detailed rows never overlap: a row grows to fit wrapped tier names or long item names, and
  short rows (the common S/A/B/C/D case) remain exactly as compact as before.
- Exported PNGs (`ExportCard`) now match the app's actual `#ff7f7f`-family tier palette instead of a
  separate, different red/orange/yellow/green/blue set the export card used to hardcode — this is an
  intentional visual change (see §13, and confirm with the user if this needs revisiting).

## 10. Backward Compatibility / Existing Data Considerations

| Existing data / behavior | After the fix |
|---|---|
| 62 templates using `S/A/B/C/D` + `bg-[#hex]` | Pixel-identical — the resolver's first rule extracts the same hex `--color-tier-*` already rendered, and the label-keyed glow (`tier-glow-s` etc.) is preserved. |
| 2 templates with Thai labels + `bg-[#hex]` (`tmpl_011`, `tmpl_013`) | Now render their stored colors instead of nothing. Verified live against local D1 restored from `.d1-snapshot.sql`. |
| Any row saved with a `bg-red-400`-style value | Covered by `LEGACY_TIER_COLORS` (built from every color format the Create/RankTierList editors have ever written). |
| `localStorage` draft `tog-create-draft` (v1) | Old drafts carry pre-fix color values; the resolver handles all of them. No draft migration, no `DRAFT_VERSION` bump. |
| `templates.tiers` JSON gaining an `id` key | Purely additive — `parseTiers()` is a plain `JSON.parse`; every reader destructures only `label`/`color` (now also optionally `id`). Rows without `id` fall back to matching by `label`. |
| `ranking_items.tier` / `template_items.tier` | Untouched. No migration, no schema change, no D1 write. |
| Home Feed / Post Detail (label-only data, no color available from the API) | Unchanged appearance for `S/A/B/C/D`; Thai/custom tier names now wrap safely inside their fixed-width badge instead of overflowing, using the same neutral fallback style as before. |

## 11. Testing Plan

No automated test suite exists in this repo (`AGENTS.md`: "There are no test or typecheck scripts; do
not invent them"). Verification was: static checks (lint, build, generated-CSS inspection) plus manual
passes against real production data restored to local D1.

**Static checks — all passed:**
```
npm run lint     # oxlint — no new warnings introduced
npm run build    # production build succeeds; confirms Tailwind emitted min-h-12 / break-words
```

**Manual passes — all confirmed against local D1 (`.wrangler/state/v3/d1`, already seeded from
`.d1-snapshot.sql`) via `npx wrangler pages dev dist --local`:**

1. `/template/tmpl_011` (`โคตรโหด/ยาก/กำลังดี/ง่ายไป`) — badges colored correctly (red/orange/yellow/blue),
   no row overlap even where the "กำลังดี" row grows to 3 items tall.
2. `/discover/hashtag/Gaming` → "Soulslike" card (`tmpl_011` preview) — colored correctly on the
   Discover card component too.
3. `/create` — renamed the S tier to a Thai phrase (`สุดยอดเยี่ยม`) and picked a new color from the
   swatch grid: color applied immediately (previously a no-op), survived the rename, survived a full
   page refresh via the draft-restore mechanism, with A/B/C/D unaffected.
4. `/rank?template=tmpl_013` (`อร่อยเทพ/อร่อย/พอไหว/ไม่รอด`) — tier column colored correctly, no overflow.
5. `/` (Home Feed) — found real production data with an extreme stress case: a `ranking_items.tier`
   value consisting of the Thai word "เนื้อ" repeated 18 times with no spaces (90 characters,
   zero natural break points) inside a 56px-wide badge. Confirmed the row still grows to fully contain
   it with **no overlap** into the rows above or below, and the rest of the page (sidebar, next post
   card) is unaffected.
6. Data-integrity check against `.d1-snapshot.sql`: wrote a one-off script cross-referencing
   `templates.tiers` labels against every `ranking_items`/`template_items` row's `tier` value — 5,132
   rows checked, 0 orphans (excluding intentional `NULL`).

## 12. Implementation Steps (as executed)

1. Added `resolveTierColor()`, `LEGACY_TIER_COLORS`, `TIER_GLOW`, `TIER_LABEL_INK` to `src/lib/tiers.js`;
   kept `TIER_STYLES` exported for backward compatibility (now unused internally).
2. Added `src/components/tier/TierLabel.jsx`, the shared badge component.
3. Updated all 7 tier-rendering call sites to use `TierLabel` instead of indexing `TIER_STYLES` by
   label: `Create.jsx`, `TemplateDetailPage.jsx`, `TemplateCard.jsx`, `RankTierList.jsx`, `TierRow.jsx`,
   `HomeFeed.jsx`, `ExportCard.jsx` (which also had its own separate, now-deleted `tierColor()` map).
4. `Create.jsx`: `DEFAULT_TIERS` and `availableColors` switched from Tailwind class-name strings to
   literal hex values (so the color-swatch buttons apply `style={{backgroundColor}}` instead of an
   invalid dynamic class name); `handlePublish` now persists `{ id, label, color }`.
5. `TemplateDetailPage.jsx`: `TierListRow` badge `h-12`/`items-center` → `min-h-12`/`items-stretch` +
   `break-words`; items column gained `min-w-0 flex-1`; item pills gained `break-words`; the three
   `key={tier.label}` React keys became `key={tier.id ?? tier.label}`; `ExportCard` preview now also
   passes `color: tier.color` through.
6. Applied the same `break-words`/`min-w-0` treatment to `TierRow.jsx`, `HomeFeed.jsx`,
   `TemplateCard.jsx` (whose preview row also switched from a hard `h-1/2` split to `min-h-0 flex-1`).
7. Updated `AGENTS.md`'s stale "map tier colors via `TIER_STYLES` only" rule to describe the new
   `resolveTierColor()`/`TierLabel` convention.
8. Verified: `npm run lint`, `npm run build`, generated-CSS inspection for `min-h-12`/`break-words`,
   and the manual browser passes in §11 against local D1 seeded from real production data.

## 13. Potential Risks / Regression Areas

- **Intentional visual change in PNG exports.** `ExportCard.jsx` previously hardcoded its own
  red/orange/yellow/green/blue palette (`#ef4444` etc.) for S/A/B/C/D, different from the app's actual
  `--color-tier-*` palette (`#ff7f7f` etc.) used everywhere else. It now uses the same resolver as every
  other screen, so exports match on-screen colors — but this does change existing exported-PNG colors
  for the classic tiers. Flagged for the user; can be reverted to a distinct export palette if preferred.
- **Class-order collisions if `TierLabel`'s `className` contract is violated.** `TierLabel` deliberately
  carries no font-size/weight so callers' `className` doesn't compete with it (Tailwind resolves
  same-specificity utility collisions by stylesheet source order, not by string order). Any future call
  site must keep following this contract.
- **Extreme unbroken-text edge case is ugly, not broken.** A pre-existing test/dev data row
  (`ranking_items.tier` = "เนื้อ" × 18, no spaces) wraps into an 18-line-tall badge in the 56px-wide
  `TierRow`/Home Feed badge. This satisfies "no overlap" but is not a polished look for pathologically
  long unbreakable labels in that specific narrow badge. Out of scope for this fix (Home Feed's badge
  width/truncation policy was not part of the reported defect); noted as a possible follow-up.
- **Deferred: `tier_id` migration.** `ranking_items.tier`/`template_items.tier` still join on the label
  string. Zero orphans exist today, and no UI can currently rename a template's tiers post-creation, but
  this remains a latent risk if such a feature is added later without first migrating to `tier_id`.
- **Deferred: tier colors on Home Feed / Post Detail.** These screens only have tier *labels* available
  (from `ranking_items`, which carries no color), not colors — so custom-Thai-named tiers there keep the
  neutral fallback badge (now wrap-safe) rather than becoming colored. Coloring them would require
  returning tier colors from `GET /api/rankings`, which adds row reads and was intentionally avoided per
  `docs/row-read-optimization-plan.md`.
- **No automated regression tests exist for this app** (`AGENTS.md`) — future changes to tier rendering
  should re-run the manual pass list in §11, particularly against `tmpl_011`/`tmpl_013` in
  `.d1-snapshot.sql`, which are the only two production templates with non-classic tier labels today.

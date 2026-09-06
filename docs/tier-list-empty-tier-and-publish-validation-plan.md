# Plan: Tier-List Empty-Tier Preservation & Publish Validation

Status: Implementation reference. Approved scope (render-only fix, validation on both Create and
`/rank`, detailed toast message naming unassigned items).

## 1. Problem statement

Two user-facing issues in the tier-list creation flow:

1. **Publishing with unassigned items.** On the Create page a user can generate items, drag some
   of them into tiers, and then publish while other items still sit in the Unranked Pool. The
   publish is not blocked; the unassigned items are silently dropped (only ranked items are ever
   written to `ranking_items`). Users are surprised that some of their items disappeared.
2. **Empty tiers vanish after publishing.** A user creates 5 tiers (S/A/B/C/D), places items only
   into S and A, and publishes. The tier list appears in the Feed / Profile / Post Detail with
   only S and A rows — the empty B/C/D tier rows are gone, even though the user intentionally
   defined 5 tiers.

## 2. Current behavior

- Create page (`/create`, `src/pages/Create.jsx`): tiers live in local `tiers` state (5 rows by
  default, fully editable — add/remove through UI, labels and colors). `handlePublish()` only
  blocks when there is **no** item at all (`errAddItem`) or when **no** item has been placed in a
  tier (`errMakeTier`). Partially-ranked lists publish fine and the leftover pool items are
  discarded.
- `/rank` page (`src/pages/RankTierList.jsx`): same pattern — `handleSaveRanking()` only sends
  `items.filter(item => item.tierId !== null)`; pool items are silently dropped.
- Publish writes only the **ranked** items to `ranking_items`, and the tier definitions go into
  `templates.tiers` (JSON) on the freshly-created template (Create.jsx always ships a `template`
  in the payload).
- Rendering `buildTierRows(rankingItems, tiersDef)` in `src/lib/tiers.js` skips every template
  tier that has no matching ranked items (`if (!itemsByLabel[t.label]) return`). This is the exact
  line that makes S/A visible and B/C/D disappear in:
  - `HomeFeed.jsx` (`HomeTierCard`)
  - `PostDetail.jsx` (`/post/:id`, "Feed detailed")
  - `Profile.jsx` (profile preview, first 2 rows)
- `TemplateDetailPage.jsx` uses its own `groupItemsByTierOrder()` (already creates a row for every
  template tier, empty included) — that page is not affected.
- Community Average (`CommunityAveragePage.jsx`) and template pages render from `templates.tiers`
  directly — all tiers are shown, including empty ones. Not affected.

## 3. Expected behavior

- **Publish blocks when any item is unassigned.** Clicking Publish/Save with ≥1 item still in the
  Unranked Pool shows a clear message naming the unassigned item(s) and the remaining count, e.g.
  "Item C is not assigned to a tier — place every item into a tier before publishing." Nothing is
  published.
- **Empty tiers are preserved everywhere.** Define S/A/B/C/D, fill only S and A, publish. Feed,
  Feed detailed and Profile must all render:
  - S → items
  - A → items
  - B → empty row (label + color, no items)
  - C → empty row
  - D → empty row
  - Order matches the template tier definition order.

## 4. Root cause (from investigation)

1. **Unassigned items dropped on publish:** `Create.jsx:292-298` and `RankTierList.jsx:182` only
   ever send `items.filter(item => item.tierId !== null)` to `POST /api/rankings`. There is no
   check that the pool is empty before sending.
2. **Empty tiers disappear at render time:** `src/lib/tiers.js:146`
   `if (!itemsByLabel[t.label]) return` drops any defined tier with zero items before the rows are
   emitted. The tier definitions themselves are already fully persisted — `Create.jsx` always
   creates a template whose `templates.tiers` JSON includes all 5 tiers (empty ones included), and
   `GET /api/rankings` already returns that full `tiers` array from the template. The data is
   complete; the renderer throws the empty rows away. (Persistence is NOT the bug for the Create
   flow — see §7.)

## 5. Data flow (Create → Publish → Save → Feed/Profile)

1. User builds tiers + items on `Create.jsx` (local `tiers` and `items` state).
2. `handlePublish()` → `payload` + `template` + `items` (only `tierId !== null`) →
   `POST /api/rankings` (`functions/api/rankings.js`).
3. Backend, in one `db.batch()`:
   - creates a `templates` row with `tiers = JSON.stringify(template.tiers)` — **all 5 tiers,
     empty included**;
   - creates the `rankings` row linked via `template_id`;
   - creates `ranking_items` rows only for the sent (ranked) items;
   - writes `ranking_item_scores` for the scored items (empty tiers simply contribute nothing).
4. `GET /api/rankings` (list + `id=`) reads `ranking.template_id`, loads `templates.tiers`,
   `parseTiers()` → returns the full `tiers` array on every item.
5. `HomeFeed` / `PostDetail` / `Profile` call `buildTierRows(post.ranking_items, post.tiers)` —
   step that currently deletes empty rows.

## 6. Proposed architecture / implementation

Pure frontend change. No database schema, migration, or API change. All required data already
exists end-to-end; the fix is to stop discarding it.

### 6.1 Create-page publish validation

`src/pages/Create.jsx` — `handlePublish()`:

- Keep all existing guards untouched (login → title → hashtags → `errAddItem` → `errMakeTier`).
- After the existing checks, add:

```js
const unrankedItems = items.filter((item) => item.tierId === null);
if (unrankedItems.length > 0) {
  const names = unrankedItems.slice(0, 3).map((i) => i.content).join(', ');
  const more = unrankedItems.length > 3 ? t('create.errUnrankedItemsMore', { n: unrankedItems.length - 3 }) : '';
  return toast.error(t('create.errUnrankedItems', {
    count: unrankedItems.length,
    names,
    more
  }));
}
```

- Validate on click (at the moment the user attempts to publish), consistent with the existing
  `toast.*` guards. No inline/live validation to avoid false blocking while editing.
- If **all** items are unranked the existing `errMakeTier` path still fires first (unchanged).

### 6.2 `/rank` publish validation (Use Template flow)

`src/pages/RankTierList.jsx` — `handleSaveRanking()`:

- Keep existing guards (login → title → hashtags). Add the equivalent check before building the
  payload:

```js
const unrankedItems = items.filter((item) => item.tierId === null);
if (unrankedItems.length > 0) {
  const names = unrankedItems.slice(0, 3).map((i) => i.content).join(', ');
  const more = unrankedItems.length > 3 ? t('rank.errUnrankedItemsMore', { n: unrankedItems.length - 3 }) : '';
  return alert(t('rank.errUnrankedItems', {
    count: unrankedItems.length,
    names,
    more
  }));
}
```

- This page uses `alert()` for its existing guards; keep that pattern.

### 6.3 Empty-tier preservation (`src/lib/tiers.js` — `buildTierRows`)

- Stop skipping empty template tiers. Every tier in `tiersDef` must produce a row, with
  `items: itemsByLabel[t.label] || []`.
- Keep the existing `seen` Set and the trailing loop that appends item-only labels (tiers that
  appear in `ranking_items` but not in `tiersDef` — e.g. legacy/template-less rankings) so no item
  is ever dropped.
- Resulting shape unchanged: `[{ tier, color, index, items }]` — callers already tolerate empty
  `items` (every renderer maps over `items` and the flex containers keep `min-h-[50px]`).

### 6.4 Rendering consumers (no change needed, verified)

- `HomeFeed.jsx:115`, `PostDetail.jsx:47`, `Profile.jsx:341` — all call `buildTierRows`, so the
  one fix propagates everywhere. Empty rows render as empty containers with the tier label/color.
- `TemplateDetailPage.jsx` `groupItemsByTierOrder()` — already preserves all tiers.
- `CommunityAveragePage.jsx` — template-driven, already fine.
- No changes to `TierRow`, `TierLabel`, `ExportCard`, `HomeTierCard` needed: they all already
  render zero-item rows correctly (empty flex area keeps the row height).

### 6.5 i18n strings

- `src/locales/en.json`
  - `create.errUnrankedItems`:
    "Unranked items ({{count}}): {{names}}{{more}} Please put every item into a tier before
    publishing."
  - `create.errUnrankedItemsMore`: " and {{n}} more" (suffix set in the component only when more
    than 3 items are unranked).
  - `rank.errUnrankedItems` / `rank.errUnrankedItemsMore`: same wording for the Save flow.
- `src/locales/th.json` — Thai equivalents.
- The `{{more}}` suffix keeps the toast short; the base string is a single interpolated message.

## 7. Why no data-model change is required

- `templates.tiers` is the single authoritative, immutable source of tier definitions for every
  ranking created via `/create` (always ships a template) and via `/rank?template=…` (uses the
  source template's tiers). It is already written with the full tier list, empty tiers included.
- `GET /api/rankings` already returns that array as `tiers`.
- Therefore the "empty tiers are not being persisted" hypothesis is false for the main flows; the
  failure was purely in `buildTierRows()` discarding rows.
- Known limitation (accepted, out of scope, documented for the team): a ranking published from
  `/rank` **without** a template (template-less) has no stored tier definitions at all, and a
  ranking whose template was later deleted resolves to `tiers: null`. Such rows can only ever show
  tiers that actually contain items. Fixing those would require persisting a tier snapshot on the
  `rankings` row (schema + API change) — deliberately deferred per decision.

## 8. Backward compatibility

- Existing published lists with a template: after the fix their full tier set (empty rows
  included) will start showing — this is the intended behavior change, not a regression. Order,
  colors and the S/A/B/C/D fallback palette are derived from the same `templates.tiers`/`tiersDef`
  path already used today.
- Template-less legacy lists: unchanged (they had no empty-tier data; behavior stays as-is).
- Unassigned-items validation: existing guards and valid publish paths are untouched; the new
  check only fires when part of the pool is still unranked. Save/format untouched.
- No DB writes, no migration, no API contract change.

## 9. Test strategy (no test framework exists; AGENTS.md forbids inventing one)

Verification:
- `npm run lint` (oxlint) — no new errors.
- `npm run build` — production build succeeds.
- `npx wrangler pages dev dist --local` — full-stack manual scenarios:

  1. Create 5 tiers S/A/B/C/D, add items, place items into S and A only, leave B/C/D empty →
     Publish → Feed card shows all 5 rows (B/C/D empty). Open `/post/:id` → same. Open
     `/profile/me` → first rows include S/A as before.
  2. Same but place items into 1 tier, leave 4 empty → still 5 rows.
  3. Same but place items in ALL 5 tiers → still exactly 5 rows, correct order/colors.
  4. Generate items and publish with some items still in the pool → blocked, toast names them.
  5. Publish with all items unranked → existing `errMakeTier` message (unchanged).
  6. "Use Template" → place items in 2 of 5 tiers → Save → `/` and profile show all 5 rows;
     leaving pool items behind shows the validation message.
  7. Template-less `/rank` (no `?template=`) → unchanged behavior (only populated tiers shown).
  8. Ranking with zero items → empty Feed fallback unchanged (`HomeTierCard` fallback rows).

## 10. Edge cases

- `tiersDef` empty/null (template-less): existing extra-rows path runs; empty rows impossible
  (no definitions) — unchanged.
- Item label not present in `tiersDef` (case mismatch, label renamed after ranking saved): still
  rendered via the trailing extra-rows loop.
- Duplicate tier labels inside one `tiersDef`: every defined tier now gets a row (labels are keys
  for items, not for row identity) — matches template-author intent; pre-existing edge.
- Many unranked items: toast lists up to 3 names + "and N more"; count shown.
- Empty tiers in export (`ExportCard`/`CommunityAvgExportPreview`): exported image now includes
  empty rows — matches the new screen behaviour.
- HomeFeed fallback (`builtRows.length === 0` → 2 placeholder rows): with a non-empty `tiersDef`
  `builtRows` is never empty, so the fallback only applies to definition-less empty lists (as
  before).

## 11. Acceptance criteria

- Publish/Save is blocked whenever ≥1 item is still in the Unranked Pool; message names the
  unassigned item(s) + count; nothing is written to the DB.
- All existing validation messages and valid publish flows still work.
- A defined tier with zero items is still rendered (label + color + empty container) in Feed, Feed
  detailed and Profile, in the template tier order.
- `templates.tiers` / `GET /api/rankings` remain the source of truth; no schema/migration change.
- `npm run lint` and `npm run build` pass.

## 12. Files to change

- `src/lib/tiers.js` — `buildTierRows()`: keep empty template tiers.
- `src/pages/Create.jsx` — unassigned-item validation in `handlePublish()`.
- `src/pages/RankTierList.jsx` — unassigned-item validation in `handleSaveRanking()`.
- `src/locales/en.json`, `src/locales/th.json` — new `create.errUnrankedItems` /
  `create.errUnrankedItemsMore` and `rank.errUnrankedItems` / `rank.errUnrankedItemsMore` strings.
- This document.
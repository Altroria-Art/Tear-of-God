# Feed debug: new posts not visible + tier colors missing in Feed

Status: **Implemented**. This document records the investigation and fix for two follow-up problems
discovered while verifying the Tier List color/layout fix (`docs/tier-list-ui-fix-plan.md`):

1. A newly published Tier List did not appear on the first pages of the Home Feed.
2. The same ranking's tier colors rendered correctly on Discover Detailed but not on Home Feed or
   Feed Detailed (`/post/:id`).

## 1. Problem Summary

After `docs/tier-list-ui-fix-plan.md` shipped, the user could not verify the Tier color fix in the
Feed because:

- Publishing a new Tier List from `/create` did not surface it on the Home Feed's first page(s),
  making it look like the post never appeared.
- An existing template with long Thai tier names (`โคตรโหด/ยาก/กำลังดี/ง่ายไป` on `tmpl_011`,
  and a ranking against a similar template with `อร่อย/…/ไม่อร่อย`) showed colored tiers on
  `/template/:id` but grey/uncolored tiers on `/` and `/post/:id`.

## 2. Reproduction Steps

1. `npm run build && npx wrangler pages dev dist --local` against local D1 restored from the
   production snapshot (`.d1-snapshot.sql`).
2. Log in as an existing user, publish a new Tier List from `/create` with a novel category (e.g.
   `test`).
3. Observe: the new post is not on Home Feed page 1 or 2 of infinite scroll.
4. Open `/post/<id-of-a-ranking-with-a-long-Thai-tier-template>` — tier badges render with the
   neutral fallback style, no color.
5. Open `/template/<same-template-id>` — the same tiers render correctly colored.

## 3. Observed Behavior by Page

| Page | Route | New post visible? | Tier color |
|---|---|---|---|
| Home Feed | `/` | Not on early pages (personalized order buried it on page 3) | Missing for non-classic labels |
| Feed Detailed | `/post/:id` | n/a (reached via feed, once found) | Missing for non-classic labels |
| Discover Detailed | `/template/:id` | n/a | Correct |

## 4. Create → Publish → Database → Feed Data Flow

Traced end to end against real requests/D1 rows, not assumptions:

```
Create.jsx (handlePublish)
  → POST /api/rankings  { payload, template, items }
  → functions/api/rankings.js  POST handler
      → INSERT INTO templates (…, tiers)         -- tiers JSON incl. `id` (see tier-list-ui-fix-plan)
      → INSERT INTO template_items (…)
      → INSERT INTO rankings (…)
      → INSERT INTO ranking_items (…, tier, position)
  → D1 (local, restored from .d1-snapshot.sql)
```

**Confirmed the write succeeds.** Directly queried local D1 after publishing a test post:

```
id=8217a622-…  title=aegaeg  category=test  template_id=bec359f4-…  created_at=2026-08-31 13:29:03
tiers JSON = [{"id":"t1","label":"หกะ้หพ้","color":"bg-red-400"}, …]   -- `id` present, from the
                                                                          previous fix's additive change
```

So the ranking, its template, and the tier `id`s all persist correctly — options A ("not published
correctly") and G ("different data shape between old/new") from the investigation checklist are ruled
out directly.

**Feed read side**, before this fix — `GET /api/rankings` (used by `HomeFeed.jsx` via
`fetchRankings()` in `src/lib/api.js`) — was queried directly:

| Request | Result |
|---|---|
| `?user_id=<viewer>&page=1&limit=5` (what HomeFeed actually sends) | `aegaeg` **not present** |
| `?user_id=<viewer>&page=3&limit=5` | `aegaeg` **found** |
| `?page=1&limit=5` (no `user_id`, anonymous/non-personalized) | `aegaeg` is **#1** |

This isolates the cause to `functions/api/rankings.js`'s personalized ordering (option J — a
different root cause than any of A–I as literally stated, though closest to a hybrid of B "not
returned as expected on the requested page" and I in spirit, since it's about how the API's own
non-Discover branch orders/shapes data).

## 5. Discover Data Flow

```
Discover.jsx / TemplateDetailPage.jsx
  → GET /api/templates?id=…
  → functions/api/templates.js
      → SELECT * FROM templates WHERE id = ?   -- includes `tiers` TEXT column directly
      → parseTiers(template.tiers)             -- JSON.parse, returns [{id?,label,color}, …]
  → response.data.tiers = [{label, color}, …]
  → TemplateDetailPage's TierListRow renders TierLabel with { label: tier.label, color: tier.color }
```

This is the **only** endpoint that ever returned tier colors. `GET /api/rankings` (both the list
branch used by Home Feed and the `?id=` detail branch used by Feed Detailed) never selected from
`templates` at all before this fix — confirmed by inspecting the actual JSON keys returned:

```
GET /api/templates?id=…       → data keys include: tiers  (array of {label, color})
GET /api/rankings (list)      → 'tiers' in row === false
GET /api/rankings?id=…        → top-level keys end at ranking_items, comments — no `tiers`
```

## 6. Root Cause Analysis

### 6a. Why new Tier Lists do not appear in Feed (checklist: closest to B)

`functions/api/rankings.js` (list branch, line ~101 pre-fix) sets
`usePersonalized = !sort && !!currentUserId && !authorId`. `HomeFeed.jsx` calls `fetchRankings({
userId, feedType, page, limit })` with no `sort` — so every logged-in Home Feed request is
personalized. The personalized branch orders by:

```sql
ORDER BY COALESCE(aff.affinity, 0) DESC, r.created_at DESC, r.id DESC
```

where `aff` is a per-category count of the viewer's own past likes (`votes` joined to `rankings`,
grouped by `category`). A brand-new post in a category the viewer has never liked scores
`affinity = 0` and sorts **behind every post in a category they have liked**, regardless of how
recent it is. Measured for the actual test account (`affinity: food=1, tech=1`): the new `test`-category
post landed at **global position 15** — page 3 of a 5-per-page feed. This is not a bug in the
affinity logic itself (it is working exactly as `docs/row-read-optimization-plan.md` §"personalized
branch" describes it, deliberately) — it is a **missing case**: the ordering never accounts for "this
is the viewer's own brand-new post."

Checklist items ruled out with evidence, not assumption:

- **A** (not published correctly) — ruled out, row confirmed in D1 with correct `id`/`template_id`.
- **C** (Feed component filters it out) — ruled out, the API itself never returns it on page 1/2;
  nothing left for the component to filter.
- **D** (component fails to render) — n/a, same reason.
- **E** (local/production environment mismatch) — ruled out, this is a pure query-logic issue
  reproducible against the exact production data snapshot restored locally.
- **F/I13 caching, dedup** — ruled out: logged-in requests get `Cache-Control: private, no-store`
  (`functions/api/rankings.js`), and `HomeFeed.jsx`'s `feedCacheRef` resets on every mount/tab switch.
- **H** (Tier ID/TierLabel fix regression) — ruled out, see §9.

### 6b. Why Feed / Feed Detailed have no tier color, and Discover Detailed does (checklist: I)

`ranking_items.tier` (`schema.sql`) stores only the tier's **label string** — no color, no id.
Color/id live exclusively in `templates.tiers` JSON. `functions/api/templates.js` reads and returns
that JSON; `functions/api/rankings.js`, before this fix, never joined or queried `templates` at all —
its list and detail branches only ever selected from `rankings`/`ranking_items`/`profiles`/`votes`.

So the two pages receive genuinely different data shapes for the exact same ranking:

```js
// Discover Detailed (via /api/templates?id=)
tier = { label: "อร่อย", color: "bg-emerald-400" }   // → resolveTierColor("bg-emerald-400", "อร่อย") → real color

// Feed / Feed Detailed (via /api/rankings, before this fix)
tier = "อร่อย"                                        // bare string — resolveTierColor(undefined, "อร่อย") → null
```

`resolveTierColor(undefined, label)` correctly returns `null` for a non-classic label with no color
argument — this is **`TierLabel`/`resolveTierColor` working exactly as designed** (per
`docs/tier-list-ui-fix-plan.md`); the previous fix was never wrong, it was simply never given the
color data on this code path in the first place. This directly answers checklist item I: **yes, Feed
and Discover Detailed use different APIs (`/api/rankings` vs `/api/templates`) with different
normalization**, and that is the entire explanation for §"Second Priority."

### 6c. Two additional pre-existing bugs found while tracing (not part of the reported symptom, but
directly relevant to "what a fix must not make worse")

- `HomeFeed.jsx` (pre-fix): `const tier = ri.tier || 'S'` — an unranked item (`ranking_items.tier IS
  NULL`) was coerced into a fabricated `S` row. Confirmed against real data: 8 rankings in the local
  snapshot contain `NULL`-tier `ranking_items` (e.g. `หนังทริลเลอร์จิตวิทยา`,
  `ภาษาโปรแกรมสำหรับ AI/Data`). This is the exact bug already fixed in
  `TemplateDetailPage.groupItemsByTierOrder` per `docs/feature-template-detail-page.md` §8, but it was
  never applied to the Feed's independent grouping logic.
- `PostDetail.jsx` (pre-fix): `tiersMap[ri.tier]` with `ri.tier === null` uses the JS object key
  `"null"` — items with no tier rendered under a row literally labeled `null`.

Left unfixed, simply "adding color" on top of these would have painted a bogus red `S` row and a row
labeled `null`, making the page look more broken, not less.

## 7. Evidence from Actual Code

- `functions/api/rankings.js` — personalized `ORDER BY` (pre-fix, line ~164) and the complete absence
  of a `templates` reference anywhere in the file.
- `functions/api/templates.js` — `parseTiers()` and the detail branch's `tiers: tiersDef` field,
  proving the color data exists and is served correctly on that one endpoint.
- `.wrangler/state/v3/d1` (local D1, restored from `.d1-snapshot.sql`) — direct `wrangler d1 execute`
  queries against `rankings`, `templates`, `ranking_items`, `votes` confirmed every claim above with
  real rows, including `EXPLAIN QUERY PLAN` for the pin-ordering query (§12).
- `git diff` against the commit that shipped `docs/tier-list-ui-fix-plan.md` — confirms
  `HomeFeed.jsx`'s tier-grouping function and all of `PostDetail.jsx` were untouched by that fix (see
  §9).

## 8. Relevant Files

| File | Role |
|---|---|
| `functions/api/rankings.js` | GET (list + detail) / POST for rankings — root cause of both problems, and where both fixes live |
| `functions/api/templates.js` | Reference implementation `parseTiers()` was modeled on (Discover's working path) |
| `src/lib/tiers.js` | `resolveTierColor()`, now also index-fallback + shared `buildTierRows()` |
| `src/components/tier/TierLabel.jsx` | Shared badge, now also accepts `index` |
| `src/pages/HomeFeed.jsx` | Home Feed — `HomeTierCard`'s tier grouping, `fetchRankings()` caller |
| `src/pages/PostDetail.jsx` | Feed Detailed — tier grouping, `fetchRanking()` caller |
| `src/components/feed/TierRow.jsx` | Shared tier-row component used by both Home Feed and Feed Detailed |
| `src/lib/api.js` | `fetchRankings()`/`fetchRanking()` client wrappers (unchanged — already passed `user_id`/params through) |
| `docs/row-read-optimization-plan.md` | Prior art for the personalized-branch design this fix extends |
| `docs/feature-template-detail-page.md` | §8 — the NULL-tier bug this fix also applies to Feed |

## 9. Why Discover Detailed Works

Discover Detailed reads tier data from `GET /api/templates?id=…`, which has always selected
`templates.tiers` directly and returned it as `{label, color}` objects. It was never touched by
either the previous fix (which only changed how that data is *rendered*, not fetched) or this one.

## 10. Why Feed / Feed Detailed Fails

Both `GET /api/rankings` branches never selected from `templates` before this fix — they had no color
data to give `TierLabel` in the first place. This is a **data-availability gap**, not a rendering bug:
`TierLabel`/`resolveTierColor` do the right thing with the input they receive; the input was simply
incomplete on this one endpoint.

## 11. Why New Tier Lists Do Not Appear in Feed

The personalized feed ordering (`COALESCE(aff.affinity,0) DESC, created_at DESC`) has no term that
recognizes "this row is the viewer's own just-published post" — a brand-new post in an unfamiliar
category sorts behind the viewer's affinity categories regardless of recency, which can push it several
pages deep on a small `PAGE_SIZE` (5).

## 12. Recommended Fix (implemented)

### A. `functions/api/rankings.js`

1. **Return `tiers`** on both branches:
   - List branch: batch-fetch `SELECT id, tiers FROM templates WHERE id IN (…)` for the distinct
     `template_id`s of the returned page only (≤ `limit`, run via `Promise.all` alongside the existing
     `ranking_items` query — no added round-trip latency, and bound params stay well under D1's 100
     cap since it's scoped to one page, not the whole table).
   - Detail branch: one `SELECT tiers FROM templates WHERE id = ?` when the ranking has a
     `template_id`; `null` otherwise.
   - Both use a `parseTiers()` helper duplicated from `functions/api/templates.js` (no shared-helper
     module exists in `functions/` yet; 6 lines duplicated beats introducing a new convention for this
     fix).
2. **Pin the viewer's most recent post** (personalized branch only) via a `mine` CTE:
   ```sql
   mine AS (
     SELECT id FROM rankings
     WHERE user_id = ? AND created_at > datetime('now', '-1 day')
     ORDER BY created_at DESC, id DESC LIMIT 1
   )
   …
   ORDER BY (c.id = (SELECT id FROM mine)) DESC, COALESCE(aff.affinity, 0) DESC, c.created_at DESC, c.id DESC
   ```
   Verified via `EXPLAIN QUERY PLAN`: resolves as `SEARCH rankings USING COVERING INDEX
   idx_rankings_user_created (user_id=? AND created_at>?)` (an index already added by
   `migrations/0006_feed_indexes.sql`), evaluated once as a scalar subquery — the rest of the query
   plan is byte-for-byte unchanged. Confirmed against real data that the new post sorts to position #1.
   The 24-hour window is a deliberate choice (confirmed with the user) so a user who hasn't posted
   recently doesn't have a stale post pinned indefinitely; it is a single named constant, trivial to
   change or remove.
3. Added `ORDER BY ri.position ASC` to the detail branch's `ranking_items` query (previously
   unordered — the list branch already had this).

### B. `src/lib/tiers.js`

- `resolveTierColor(color, label, index)` gains an optional third parameter, checked **after** the
  classic-label fallback (a template can store tiers out of S/A/B/C/D order, so the label must win
  over position — verified against the one real template that does this: `A,S,D` order). Used only
  when a ranking has no template at all (`tiers: null`) and thus no color data exists anywhere for it.
- New shared `buildTierRows(rankingItems, tiersDef)` — used by both `HomeFeed.jsx` and
  `PostDetail.jsx` so they group/order/color tiers identically instead of maintaining two independent
  implementations. Groups items by tier label, orders rows by the template's tier order (skipping
  tiers with no items, matching existing behavior), appends any label present in `ranking_items` but
  absent from `tiersDef` (defensive — not currently reachable, since the tier-color audit in
  `docs/tier-list-ui-fix-plan.md` found zero orphaned rows in production), and — critically — **skips
  `ranking_items` with a falsy `tier`** instead of coercing them into a fake row, fixing §6c.

### C. `src/components/tier/TierLabel.jsx`, `src/components/feed/TierRow.jsx`, `src/components/ui/ExportCard.jsx`

- `TierLabel` forwards the new `index` prop into `resolveTierColor`.
- `TierRow` accepts and forwards `color`/`index`.
- `ExportCard` passes its own tier's array index as `index` for the same fallback behavior in
  exported PNGs.

### D. `src/pages/HomeFeed.jsx`, `src/pages/PostDetail.jsx`

- Replaced the local, buggy tier-grouping logic with `buildTierRows(rankingItems, post.tiers)`.
- Render tier rows in template order with real colors; unranked items no longer appear under a fake
  `S` or `null` row.
- `ExportCard`'s `tiers` prop now includes `color` (previously color-less on these two pages).

## 13. Alternative Fixes Considered

- **`LEFT JOIN templates` instead of a second batched query.** Rejected for the personalized branch:
  `EXPLAIN QUERY PLAN` shows the join would run for every row in the ~100-row `cand` candidate set,
  not just the `limit` rows actually returned; the batched-by-page-only query touches at most `limit`
  template rows.
- **Client-side pin (sort the array in `HomeFeed.jsx` after fetching).** Rejected: the pinned post
  might not even be on the fetched page (it could be several pages deep in the un-pinned ordering),
  so client-side sorting of one page's data cannot guarantee it appears on page 1 without fetching
  extra data speculatively. The `mine` CTE fixes this at the source once, correctly, for both page 1
  and any deeper page (which naturally excludes the already-shown pinned post via OFFSET, verified).
- **Turn off personalization entirely (`sort=recent`) for Home Feed.** Rejected as user-facing
  behavior change beyond what was asked, and discards intentional product behavior recorded in
  `docs/row-read-optimization-plan.md`.
- **Unconditional pin (no 24h window).** Considered and explicitly rejected by the user in favor of a
  time-bounded pin, to avoid an old post being glued to the top of the feed forever.
- **Index-fallback color assigned before the classic-label check.** Rejected: would have painted the
  one real template with an out-of-order S/A/D sequence (`A,S,D`) with the wrong colors by position;
  verified label-first is correct against that actual row.

## 14. Backward Compatibility

- `tiers` is **added** to `GET /api/rankings` responses; no existing field renamed or removed. Any
  client not reading it is unaffected.
- Rankings with `template_id = NULL` (6 of 633 in the local snapshot) get `tiers: null` — every new
  code path (`buildTierRows`, `resolveTierColor`) already handles `null`/`undefined` tier definitions
  without throwing, falling through to the index-based color and the "extra row" branch.
- No schema change, no migration, no D1 write — purely additive reads plus one comparison term in an
  existing `ORDER BY`.
- Legacy tier color formats already resolved via `LEGACY_TIER_COLORS` (from the previous fix) continue
  to work unchanged; verified against the actual colors stored for the reported post
  (`bg-emerald-400`, `bg-orange-300`, `bg-yellow-300`, `bg-green-400`, `bg-blue-400`).
- `buildTierRows` accepts the exact same `ranking_items` shape as before; only its second argument
  (`tiersDef`) is new, and it is optional (`tiersDef || []`).

## 15. Testing Plan

No automated test suite exists in this repo (`AGENTS.md`). Verification was: lint, build, direct D1
queries (including `EXPLAIN QUERY PLAN`), direct API calls via `curl`, and browser screenshots against
local D1 restored from the production snapshot.

```
npm run lint && npm run build
npx wrangler pages dev dist --local
```

1. `curl "…/api/rankings?user_id=<viewer>&page=1&limit=5"` → the just-published post is **#1**, and
   every row's `tiers` field is present (or `null` for template-less rows) — confirmed.
2. `curl "…/api/rankings?id=<ranking with long-Thai-tier template>"` → `tiers` array present with the
   same `label`/`color` values as `GET /api/templates?id=<its template>` — confirmed identical.
3. `curl "…/api/rankings?id=<template-less ranking>"` → `tiers: null`, `ranking_items` still complete
   — confirmed (`Aeosrhdg`: `หลอกเด็ก`/`ดีมาก`/`ไว้ค่อยดู`).
4. Browser: `/post/<long-Thai-tier ranking>` — all 5 tiers colored (green/orange/yellow/green/blue),
   matching `/template/<its template>` exactly, no row overlap even with an 18-line-tall badge —
   confirmed via screenshot.
5. Browser: `/post/<template-less ranking>` — 3 custom Thai tier names each get a distinct fallback
   color (red/orange/yellow) instead of all-neutral — confirmed via screenshot.
6. Browser: `/template/<already-verified template>` (Discover Detailed) — pixel-unchanged from before
   this fix — confirmed via screenshot (regression check).
7. Publishing a 2nd new post: not independently re-verified in this pass (network-level ordering proof
   in §12/step 1 already demonstrates the pin mechanism generalizes — any single most-recent post
   within 24h resolves to the same `mine` CTE), but recommended before closing out: publish two posts
   back-to-back and confirm the 2nd bumps the 1st back into normal affinity order.

## 16. Implementation Steps (as executed)

1. `functions/api/rankings.js`: added `parseTiers()`; list branch batch-fetches and attaches `tiers`;
   detail branch fetches and attaches `tiers`, added `ORDER BY position` to its items query;
   personalized branch gained the `mine` CTE and pin term in `ORDER BY`.
2. `src/lib/tiers.js`: `resolveTierColor()` gained the `index` parameter and `TIER_FALLBACK_HEX`;
   added shared `buildTierRows()`.
3. `src/components/tier/TierLabel.jsx`: forwards `index`.
4. `src/components/feed/TierRow.jsx`: accepts/forwards `color`/`index`.
5. `src/components/ui/ExportCard.jsx`: passes array index as `index`.
6. `src/pages/HomeFeed.jsx`: removed the local buggy tier-grouping function, uses shared
   `buildTierRows`, updated render + `ExportCard` tiers mapping for the new row shape.
7. `src/pages/PostDetail.jsx`: same replacement in `loadPost`, updated `TierRow`/`ExportCard` call
   sites to pass `color`/`index`.
8. Verified: `npm run lint`, `npm run build`, D1 queries + `EXPLAIN QUERY PLAN`, `curl` against the
   running local API, and browser screenshots (§15).

## 17. Regression Risks

- **Visible tier row order changes on existing Feed posts.** Rows now follow the template's tier
  order instead of first-appearance-in-`ranking_items` order. This is the intended, correct behavior
  (matching Discover Detailed) but is a visual change on every existing post that has multiple tiers.
- **Unranked items no longer appear under a fake "S" row.** Posts that previously showed a padded `S`
  row full of unranked items will now show fewer/no items in that row (or no row at all if nothing was
  ranked into a real "S" tier). This is the correct fix for a real bug, but changes what some existing
  posts look like.
- **Row-read cost:** +≤`limit` template rows per feed page (batched, page-scoped), +1 per post detail
  view, +1 covering-index seek per personalized feed page for the pin. Verified via `EXPLAIN QUERY
  PLAN` that no existing scan/sort step changed; this is strictly additive and small relative to the
  volumes analyzed in `docs/row-read-optimization-plan.md`.
- **Pin edge case:** if a user publishes >100 posts within a day (unreachable at current data volumes —
  633 rankings total), their newest post could fall outside the personalized branch's `cand` candidate
  window and the pin would have no effect; this degrades to pre-fix behavior, not an error.
- **No automated regression tests exist for this app.** Future changes to Feed/Discover data flow
  should re-run the manual checklist in §15, particularly steps 1–3 (direct API shape checks) since
  they are the fastest way to catch a reintroduced data-availability gap like this one.

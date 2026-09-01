# Discover Template Uses & Views Fix Plan

## Problem

On the Discover page, each template card shows a "Uses" badge (top-right corner, people icon).
That number is **fake seed data**, wildly inflated compared to real usage — production shows
`15,200` on a template that has actually been used `13` times.

Separately, no template listing shows a Views count at all today, and the underlying
`templates.view_count` counter that the detail page relies on has already drifted out of sync with
the real view records.

## Investigation Summary

Read `docs/feature-template-detail-page.md` (§3 defines Uses/Views precisely) and
`docs/feature-discover-view-all-pages.md` (§3, FR-D2 — Discover's card is supposed to show the
same live Uses count as everywhere else, and sort supports a "views" mode). Read the full
`functions/api/templates.js` (list mode, detail mode, view-tracking POST), `schema.sql` and every
file under `migrations/` for the `templates`/`template_views`/`rankings` tables and their indexes,
`src/components/template/TemplateCard.jsx` (full file), `src/pages/Discover.jsx`,
`src/pages/CategoryPage.jsx`, `src/pages/TemplateDetailPage.jsx`, `src/lib/api.js`
(`fetchTemplates`), and `scripts/gen-community-seed.mjs` (source of the seeded `use_count` values).
Queried both the live production API and production D1 (read-only) to compare stored counters
against real derived counts, and ran `EXPLAIN QUERY PLAN` against the local D1 file to validate the
proposed query's performance characteristics before recommending it.

## Current Data Flow

**Uses**, as currently implemented:

```
Discover.jsx --fetchTemplates()--> GET /api/templates?limit=50
  --> functions/api/templates.js list-mode query:
        SELECT t.*, ..., t.use_count as live_uses FROM templates t ...
  --> mapper: use_count: t.live_uses || 0
  --> TemplateCard.jsx: <Users/> {formatCount(template.use_count)}
```

Despite the alias name `live_uses`, this selects the raw `templates.use_count` column — a value
seeded once and never representing real usage.

**Views**, as currently implemented:

```
Discover.jsx --fetchTemplates()--> GET /api/templates?limit=50
  --> functions/api/templates.js list-mode query: view_count is not selected/returned at all
  --> TemplateCard.jsx: no Views element exists
```

The only place Views renders today is `src/pages/CategoryPage.jsx:51` —
`👁️ {template.stats?.views || 0}` — but that page lists *rankings* (from `GET /api/rankings`),
whose response has no `stats.views` field, so this always renders a static `0`.

The Template Detail page (`TemplateDetailPage.jsx`) is the only place Views is real, sourced from
`functions/api/templates.js` detail-mode: `stats.views = template.view_count` (a stored counter,
not derived from `template_views` directly).

## Uses Definition

Per the existing, already-correct implementation in the detail endpoint
(`functions/api/templates.js`, detail mode):

```sql
SELECT COUNT(*) as n FROM rankings WHERE template_id = ?
```

**One "use" = one tier list (`rankings` row) created from that template.** The same user creating
two tier lists from the same template counts as two uses — this counts rankings, not distinct
users, and matches `docs/feature-template-detail-page.md` §3 exactly:
*"นับสดทุกครั้งที่เรียก API … นับจำนวน ranking ไม่ใช่จำนวนคน"*.

This is not a new definition — it is the detail page's existing, correct logic. Discover simply
never adopted it.

## Views Definition

Per the existing view-tracking mechanism (`functions/api/templates.js`, `onRequestPost`):

```sql
INSERT OR IGNORE INTO template_views (template_id, user_id) VALUES (?, ?)
-- on success (meta.changes > 0):
UPDATE templates SET view_count = view_count + 1 WHERE id = ?
```

`template_views` has `PRIMARY KEY (template_id, user_id)`
(`migrations/0002_template_views.sql`), so **one "view" = the first time a given logged-in user
opens that template's detail page.** Repeat opens by the same user are silently ignored (`INSERT
OR IGNORE`). Guests are never counted — the client only calls `recordTemplateView` when
`currentUser` exists.

The durable record of this event is the `template_views` table itself. `templates.view_count` is
meant to be a cached mirror of `COUNT(*) FROM template_views WHERE template_id = ?`, but the two
writes that maintain it are not atomic (see Root Cause), so the mirror has drifted.

## Root Cause

### Uses: a mislabeled alias

`functions/api/templates.js`, list-mode query:

```js
// Comment directly above the query claims:
// "uses" นับสดจากจำนวน rankings ที่ผูก template นี้ (ไม่ใช้ use_count ที่ seed ไว้)

const query = `
  SELECT t.*, p.username, p.avatar_url,
    t.use_count as live_uses
  FROM templates t
  LEFT JOIN profiles p ON t.creator_id = p.id
  ...
`;
```

and the mapper:

```js
const data = templates.map(t => ({
  ...
  use_count: t.live_uses || 0,
  ...
}));
```

The alias `live_uses` is *named* as if it were a live count, but the SQL simply selects the stored
`t.use_count` column unchanged. The comment states the opposite of what the code does. This is why
it went unnoticed: a reviewer reading the comment would conclude the number is already live.

`templates.use_count` itself is contaminated data: `scripts/gen-community-seed.mjs:200-202` names
it `OLD_USE_COUNT`, explicitly documenting it as *"the old (now-retired) use_count"* used only to
scale how many seed rankings to generate per template — never intended as a display value. On top
of that seeded baseline, `functions/api/rankings.js`'s `UPDATE templates SET use_count = use_count
+ 1` (run whenever a real ranking is created from a template) adds small real increments. The
result is a large fake number plus a handful of real increments layered on top — not usable as a
metric in either form.

`docs/feature-template-detail-page.md` §3 already documents that this column is retired
(*"คอลัมน์นั้นยังอยู่ใน schema เฉยๆ ไม่ถูกอ่าน/เขียนอีกต่อไป… ตัวเลขที่โชว์ทุกที่ (Discover,
Template Detail) เป็นเลขสดทั้งหมด"*). The detail endpoint honors that; **the list endpoint's code
does not, despite the doc's claim that it does.**

### Views: never surfaced by the list API, and the mirror counter drifts

The list mapper has no `view_count` field at all — it is simply absent from the SELECT and the
response object, so there is nothing for `TemplateCard` to render.

The `templates.view_count` counter that the detail page falls back to is updated by two
independent `.run()` calls rather than a single atomic `db.batch()`:

```js
const { meta } = await db.prepare(
  `INSERT OR IGNORE INTO template_views (template_id, user_id) VALUES (?, ?)`
).bind(template_id, user_id).run();

if (meta.changes > 0) {
  await db.prepare(`UPDATE templates SET view_count = view_count + 1 WHERE id = ?`)
    .bind(template_id).run();
}
```

If the worker is interrupted between these two calls (a network drop, a Workers CPU-time limit,
etc.), the `template_views` row is durably written but the counter increment is lost — the counter
under-counts and never self-heals. Verified this is the actual state of production data (see
Database Analysis below): confirmed drift on 3 of 66 templates, and the seed generator does not
insert `template_views` rows at all (`scripts/gen-community-seed.mjs` was grepped for
`template_views` — zero occurrences), so surviving `template_views` rows are all genuine
user-generated events, not seed artifacts.

## Database Analysis

Relevant tables (`schema.sql`):

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT, description TEXT, category TEXT, hashtags TEXT, tiers TEXT,
  use_count INTEGER DEFAULT 0,      -- seeded, now stale; see Root Cause
  view_count INTEGER DEFAULT 0,     -- mirror counter; drifts, see Root Cause
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE rankings (
  id TEXT PRIMARY KEY, ..., template_id TEXT, ...
  -- one row = one tier list; template_id links it back to its template
);

CREATE TABLE template_views (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, user_id)   -- guarantees one row per (template, user)
);
```

Supporting indexes already present, both **covering** for a `COUNT(*) ... WHERE template_id = ?`:

```sql
CREATE INDEX idx_rankings_template_id     ON rankings(template_id);        -- schema.sql
CREATE INDEX idx_template_views_template  ON template_views(template_id);  -- schema.sql
```

Two more indexes exist for the *old* sort approach and become unused after this fix (kept, not
dropped — see Database Changes):

```sql
CREATE INDEX idx_templates_use_count  ON templates(use_count DESC, created_at DESC, id DESC);
CREATE INDEX idx_templates_view_count ON templates(view_count DESC, use_count DESC, id DESC);
```
(both from `migrations/0006_feed_indexes.sql`)

**Conclusion: the database already contains everything needed.** No new table, column, or index is
required — `rankings.template_id` and `template_views` are exactly the event-level data needed to
compute both metrics correctly, and both already have supporting indexes.

### Production data comparison (read-only queries, verified)

| title | stored `use_count` | **real uses** (`COUNT(*) FROM rankings`) | stored `view_count` | **real views** (`COUNT(*) FROM template_views`) |
|---|---:|---:|---:|---:|
| Top Shonen Anime | 15,200 | **13** | 0 | **1** |
| Switch Games | 13,501 | **14** | 2 | **3** |
| นักบาสเกตบอล NBA ที่เก่งที่สุด | 13,500 | **13** | 0 | 0 |
| หนังซูเปอร์ฮีโร่ที่ทำเงินสูงสุด | 12,400 | **13** | 0 | 0 |
| Best 90s Thrillers | 12,300 | **13** | 0 | **1** |

Aggregate across all 66 production templates:

```
total_templates ....... 66
use_count_wrong ....... 64      (97% of templates display an incorrect Uses number)
view_count_drifted .... 3
sum(stored use_count) . 505,804
sum(real uses) ........ 627      (stored total is ~800x the real total)
sum(stored view_count)  10
sum(real views) ....... 13
```

## API Analysis

`GET /api/templates?page=&limit=&sort=&hashtag=&category=` (`functions/api/templates.js`,
list mode) is the endpoint Discover, Popular Templates, and Hashtag Detail all call through
`src/lib/api.js`'s `fetchTemplates()`. Current response fields per template:

```
id, title, description, category, hashtags, tiers, use_count, profile, template_items
```

`use_count` is the fake value described above; there is no `view_count` field. `total` and
pagination (`page`, `limit`) are correct and unaffected by this fix.

`GET /api/templates?id=` (detail mode) already does this correctly for Uses
(`SELECT COUNT(*) as n, MAX(created_at) as latest FROM rankings WHERE template_id = ?`) and returns
it as `stats.uses`. For Views it currently returns `stats.views: template.view_count || 0` — the
drifting mirror, not a direct count. This is the one place the detail page needs to also change,
so Discover and Detail agree on the same source.

`POST /api/templates` (view-tracking) already correctly represents one real user-driven event via
`INSERT OR IGNORE INTO template_views`; the bug is only in the *non-atomic* mirror update that
follows it (see Root Cause), not in the event recording itself.

No other API needs to change. `GET /api/rankings` is unrelated to templates and is not touched.

## Frontend Analysis

`src/components/template/TemplateCard.jsx` (shared by `Discover.jsx` ×2 sections,
`PopularTemplates.jsx`, and `HashtagDetail.jsx`) currently renders only:

```jsx
<div className="absolute top-2 right-2 ...">
  <Users size={14} /> {formatCount(template.use_count)}
</div>
```

There is no Views element on this card at all. `formatCount` (`src/lib/format.js`) is a generic
number formatter (`"15.2k"` style) and is not itself part of the bug — it faithfully formats
whatever it is given.

`src/pages/Discover.jsx` fetches via `fetchTemplates({ limit: 50 })` and passes the resulting
template objects straight into `TemplateCard` — no client-side transformation of counts happens
here, so once the API returns real numbers, no change is needed to `Discover.jsx` itself.

`src/pages/CategoryPage.jsx` defines its own **local** `TemplateCard` function (unrelated to the
shared component, confusingly same name) that renders rankings, not templates, and reads a
`stats.views` field that the rankings API never provides — always `0`.

`src/pages/TemplateDetailPage.jsx` already displays `stats.uses` and `stats.views` correctly from
the detail-mode API and needs no frontend change; only the backend value it consumes for `views`
changes source (mirror counter → direct count), with no shape change.

## Proposed Fix

Compute both counts inside the existing list query as two correlated scalar subqueries, replacing
the stale-column alias:

```sql
SELECT t.*, p.username, p.avatar_url,
  (SELECT COUNT(*) FROM rankings r       WHERE r.template_id = t.id) AS live_uses,
  (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views
FROM templates t
LEFT JOIN profiles p ON t.creator_id = p.id
${whereSql}
${orderSql}
LIMIT ? OFFSET ?
```

Mapper adds the second field:

```js
const data = templates.map(t => ({
  ...
  use_count: t.live_uses || 0,
  view_count: t.live_views || 0,
  ...
}));
```

Sort branches repoint at the derived aliases so displayed numbers and displayed order agree:

```js
let orderSql = ` ORDER BY live_uses DESC, t.created_at DESC, t.id DESC`;                 // 'popular' (default)
if (sort === 'recent') orderSql = ` ORDER BY t.created_at DESC, t.id DESC`;              // unchanged
else if (sort === 'views') orderSql = ` ORDER BY live_views DESC, live_uses DESC, t.id DESC`;
```

View-tracking POST becomes atomic:

```js
const insertViewStmt = db.prepare(
  `INSERT OR IGNORE INTO template_views (template_id, user_id) VALUES (?, ?)`
).bind(template_id, user_id);
const updateCounterStmt = db.prepare(
  `UPDATE templates SET view_count = (SELECT COUNT(*) FROM template_views WHERE template_id = ?) WHERE id = ?`
).bind(template_id, template_id);
await db.batch([insertViewStmt, updateCounterStmt]);

const { results } = await db.prepare(
  `SELECT COUNT(*) as n FROM template_views WHERE template_id = ?`
).bind(template_id).all();
return Response.json({ success: true, views: results[0]?.n ?? 0 });
```

(Recomputing the counter from `template_views` inside the same batch, rather than `+ 1`, makes it
self-healing for any templates that already drifted — no separate backfill migration needed.)

Detail mode's `stats.views` switches from the stored column to a direct count, keeping the same
`COUNT(*) + MAX(created_at)` query pattern already used for `stats.uses`:

```sql
SELECT
  (SELECT COUNT(*) FROM rankings r       WHERE r.template_id = ?) AS uses,
  MAX(created_at)                                                  AS latest,
  (SELECT COUNT(*) FROM template_views v WHERE v.template_id = ?)  AS views
FROM rankings WHERE template_id = ?
```
(exact statement shaped during implementation; the point is `stats.views` and Discover's
`view_count` become the same query pattern against the same table.)

`TemplateCard.jsx` gains a Views badge next to the existing Uses badge, using the same `Users`/`Eye`
icon pairing already used on `TemplateDetailPage.jsx:317`, formatted with the existing
`formatCount()`.

`CategoryPage.jsx`'s permanently-zero views badge is corrected or removed, since the rankings API
it consumes has no per-ranking view count to show (rankings are not templates).

## Data Source

| Metric | Source of truth |
|---|---|
| Uses | `rankings` table, `COUNT(*) WHERE template_id = ?` |
| Views | `template_views` table, `COUNT(*) WHERE template_id = ?` |

`templates.use_count` and `templates.view_count` remain as denormalized/legacy columns, no longer
read for display after this fix (view_count is still *written*, self-healingly, so it stays usable
as a future fast-path if the query approach ever needs to change).

## Query / Performance Considerations

Verified via `EXPLAIN QUERY PLAN` on the local D1 database. Both correlated subqueries resolve
against **covering indexes** — no table lookups, index-only reads:

```
SCAN t
SEARCH p USING INDEX sqlite_autoindex_profiles_1 (id=?) LEFT-JOIN
CORRELATED SCALAR SUBQUERY 1
SEARCH r USING COVERING INDEX idx_rankings_template_id (template_id=?)
CORRELATED SCALAR SUBQUERY 2
SEARCH v USING COVERING INDEX idx_template_views_template (template_id=?)
USE TEMP B-TREE FOR ORDER BY
```

This is a single query returning all templates for the page in one round trip — **not** one query
per template (no N+1). A `LEFT JOIN rankings ... LEFT JOIN template_views ... GROUP BY` alternative
was considered and rejected: joining two independent one-to-many tables multiplies rows
(uses × views per template), requiring `COUNT(DISTINCT ...)` and reading substantially more data
than the scalar-subquery approach — the exact "duplicate rows from JOINs" trap to avoid.

Honest cost comparison at current scale (66 templates, 633 rankings, 13 view rows):

| | Current | Proposed |
|---|---|---|
| Plan | `SCAN t USING INDEX idx_templates_use_count`, no temp sort | `SCAN t` + 2 covering-index subqueries per row + temp B-tree for sort |
| Est. rows touched (66-template page) | ~36 | ~712 |

This is a real increase, not free. It is acceptable now because: the absolute numbers are tiny: the
endpoint is edge-cached (`public, max-age=60, stale-while-revalidate=300`), keeping origin hit rate
low; Discover already requests `limit: 50` of 66 templates (most of the table) regardless; and
sorting by a computed value inherently cannot use an index — that part of the cost is unavoidable
once sorting must reflect real usage.

**Documented escape hatch, not implemented now:** if the template count grows past roughly 500,
switch to correct denormalized counters — self-heal `use_count` the same way this fix self-heals
`view_count` (recompute from `rankings`/`template_views` rather than `+ 1`), keep both counters
atomically updated on every write, and sort using the existing `idx_templates_use_count` /
`idx_templates_view_count` indexes again. Not done now because it needs a backfill pass and
reintroduces the drift risk this fix is removing, for no benefit at current scale.

## Database Changes

**No database migration is required.**

Both source tables (`rankings`, `template_views`) and both supporting indexes
(`idx_rankings_template_id`, `idx_template_views_template`) already exist and were verified via
`EXPLAIN QUERY PLAN` to serve the new query efficiently as covering indexes. `templates.use_count`
and `templates.view_count` columns are left in the schema unchanged — no drop, no backfill, no new
column.

## Files To Modify

| File | Change | Reason |
|---|---|---|
| `functions/api/templates.js` | List-mode query: replace `t.use_count as live_uses` with two correlated `COUNT(*)` subqueries; add `view_count` to the response mapper; repoint all three `orderSql` branches; correct the misleading comment | Root cause of the fake Uses number and the missing Views field |
| `functions/api/templates.js` (`onRequestPost`) | Batch the `INSERT OR IGNORE` + counter update into one `db.batch()`, recomputing the counter from `template_views` rather than incrementing | Stops further drift and self-heals existing drift, with no separate migration |
| `functions/api/templates.js` (detail mode) | `stats.views` derived from `COUNT(*) FROM template_views` instead of the stored `view_count` column | Makes Discover and Template Detail agree on one source of truth |
| `src/components/template/TemplateCard.jsx` | Add a Views badge (Eye icon + `formatCount(template.view_count)`) beside the existing Uses badge | The card has no Views element today; fixes Discover, Popular Templates, and Hashtag Detail in one place since they all share this component |
| `src/pages/CategoryPage.jsx` | Fix or remove the permanently-zero `template.stats?.views` badge | It reads a field the rankings API never provides |
| `docs/feature-template-detail-page.md` | Correct §3: Views source is `template_views` directly, not the `view_count` mirror; remove the inaccurate claim that Discover already shows live numbers | The doc currently states something the code does not do |

Not modified: `schema.sql`, any file in `migrations/`, `scripts/gen-community-seed.mjs`,
`src/lib/api.js` (`fetchTemplates` already forwards `sort`/`page`/`limit`/`hashtag`/`category`
unchanged and needs no new parameters), `src/pages/Discover.jsx` (no client-side count math to fix).

## Backward Compatibility

Full compatibility for every existing template, tier list, and page. No schema change, no API
shape removal — `view_count` is an *added* field, and `use_count` keeps the same field name with a
corrected value. Feed (`/api/rankings`) is entirely untouched. The only externally visible change
is that displayed numbers become smaller and more accurate, and Popular/Most-Viewed ordering
reshuffles to match reality — both intended outcomes of the fix, not regressions.

## Edge Cases

| Case | Behavior after fix |
|---|---|
| Template with 0 uses | `COUNT(*)` returns `0` (never NULL for a scalar `COUNT`); displays `"0"` |
| Template with 0 views | Same — `0`, not blank, not `NaN` |
| Template with many uses/views | Ordinary `COUNT(*)`, no special-casing needed at any scale tested |
| Deleted tier list | `rankings` rows are the count source directly; deleting one lowers Uses immediately — correct, no stale cache to invalidate |
| Deleted user | Cascades remove their rankings/views (`ON DELETE CASCADE` on both `rankings.user_id` and `template_views` via `profiles`); counts adjust automatically |
| Templates with no usage/view records at all | Both subqueries naturally return `0` for a template with zero matching child rows |
| Duplicate usage records | Not applicable — every `rankings` row is a distinct, intentional use by definition; there is no dedup concept for Uses |
| Duplicate view records | Structurally impossible — `PRIMARY KEY (template_id, user_id)` rejects a second insert for the same pair |
| Cached Discover responses | Unchanged 60s edge cache; a brand-new use/view can be invisible on Discover for up to 60s, same latency window that already existed for every other field on this endpoint |
| Pagination | `LIMIT/OFFSET` and `total` (`COUNT(*) FROM templates`) are untouched by adding subqueries to the SELECT list; page boundaries do not shift |
| Sorting by popularity/views | `popular` and `views` sorts now reflect real data; the existing `t.id` tiebreaker is preserved so pagination remains stable across identical counts |

## Verification Plan

1. Create a tier list from a template whose current Uses is known; reload Discover and confirm
   Uses increased by exactly 1, and Views on that template is unchanged.
2. As a user who has never opened a given template's detail page, open it; reload Discover and
   confirm Views increased by exactly 1, and Uses is unchanged.
3. Verify step 1 does not move Views, and step 2 does not move Uses — the two metrics are checked
   independently in both directions, not just that "something increased."
4. Re-open the same template detail page as the same user from step 2; confirm Views does **not**
   increase again (dedup via `PRIMARY KEY`).
5. Confirm a template with zero rankings and zero `template_views` rows displays `0` for both
   metrics on its Discover card, not blank or an error.
6. Confirm a template with many uses/views (e.g. the current top seeded templates) displays a
   small, plausible real number, not the old inflated seed value.
7. Load Discover with multiple templates visible; confirm each card's Uses/Views are independently
   correct per template (no cross-template leakage from a bad JOIN).
8. Page through `/discover/templates` (pagination); confirm no duplicate or skipped templates
   across pages, and each page's counts are internally consistent.
9. Compare a template's numbers on its Discover/Popular-Templates/Hashtag-Detail card against its
   own Template Detail page — they must match exactly, since both now derive from the same tables.
10. Time or trace the templates list query (Miniflare observability, as used in
    `docs/row-read-optimization-plan.md` §13) to confirm the row-read cost lands near the estimate
    in this plan and does not balloon unexpectedly.
11. `npm run lint` clean; `npm run dev:full` full-stack manual pass across Discover, Popular
    Templates, Hashtag Detail, Template Detail, Post Detail (`AboutTemplateCard`), and
    `RankTierList` template pre-fill to confirm nothing else broke.

## Implementation Steps

1. Write this plan document.
2. Update `functions/api/templates.js` list-mode query, mapper, and `orderSql` branches; fix the
   comment.
3. Verify via direct API calls (`GET /api/templates?limit=5`) that `use_count` now reflects real
   counts and `view_count` is present and correct, before touching any frontend file.
4. Update `functions/api/templates.js`'s view-tracking `onRequestPost` to batch the two writes and
   self-heal the counter.
5. Update `functions/api/templates.js` detail mode's `stats.views` to derive from `template_views`.
6. Update `src/components/template/TemplateCard.jsx` to render the new Views badge.
7. Fix `src/pages/CategoryPage.jsx`'s dead `stats.views` reference.
8. Correct `docs/feature-template-detail-page.md` §3.
9. Run the full verification plan above.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Displayed numbers drop dramatically (e.g. 15,200 → 13) and are mistaken for a new bug | Expected and correct — quantified above (64 of 66 templates change; ~800x aggregate inflation removed). Call this out explicitly when the fix ships. |
| Popular-sort ordering visibly reshuffles | Also expected — the old order was sorted by fictional data. Real Uses values cluster tightly (12–14 in the current top templates), so ties are common; the existing `t.id` tiebreaker keeps ordering deterministic and pagination stable. |
| Row-read cost increases (~36 → ~712 estimated per uncached 66-template page) | Quantified in Query/Performance Considerations; both subqueries are covering-index reads, the endpoint is edge-cached, and an escape hatch (self-healing denormalized counters) is documented for if template count grows substantially. |
| Sorting by a computed value cannot use an index | Inherent to correctness — a fake-but-indexed sort order is not an acceptable alternative. Accepted at current scale. |
| Detail page's optimistic `POST` response (`views`) gets out of sync with the new derivation | `POST /api/templates` is updated in the same change to return a value computed the same way (`COUNT(*) FROM template_views`), so `TemplateDetailPage.jsx`'s existing overwrite-with-POST-result logic continues to work unchanged; verified in step 5 of Implementation Steps. |
| Scope creep into dropping/migrating `use_count`/`view_count` columns | Explicitly out of scope — columns are left in place untouched; this is a read-path and write-consistency fix only. |

# Discover Template View Refresh & Tracking Fix Plan

## Problem

1. **Stale Discover view count.** On the Discover page, a template card shows `Views: 0`. The user
   opens that template's detail page; the detail page correctly records a view and shows `Views: 1`.
   The user navigates back to Discover — the same card still shows `Views: 0`.
2. **Required Uses behavior (to verify, not assume correct).** Creating a tier list from a template
   must increase Uses by exactly +1 and must not touch Views.
3. **Required Views behavior (to verify, not assume correct).** Opening a template must increase
   Views by +1 only the first time a given account opens it; repeat opens by the same account must
   not increase it again; different accounts each count once.

## Existing Implementation

**Discover data flow:** `src/pages/Discover.jsx:18-30` fetches `fetchTemplates({ limit: 50 })` in a
`useEffect` with an empty dependency array, storing the result in local `useState`. There is no
`useRef` cache and no module-level cache in this file.

**Template Detail data flow:** `src/pages/TemplateDetailPage.jsx:225-248` fetches the template via
`GET /api/templates?id=` and, in the same effect, POSTs a view via `recordTemplateView` when
`currentUser` exists. It deliberately overrides `stats.views` with the value returned by the POST
response rather than the GET response, with an inline comment explaining why (the GET can race
ahead of the POST's `UPDATE` and read a stale number otherwise).

**View tracking:** `functions/api/templates.js` `onRequestPost` (`:249-288`) performs
`INSERT OR IGNORE INTO template_views (template_id, user_id)` followed by an `UPDATE templates SET
view_count = (SELECT COUNT(*) FROM template_views WHERE template_id = ?)`, both inside one
`db.batch()` call.

**Use tracking:** `functions/api/rankings.js` (`POST`, around `:328-339`) inserts a `rankings` row
and separately does `UPDATE templates SET use_count = use_count + 1`. Both list and detail modes of
`GET /api/templates` ignore that legacy counter and instead compute Uses live as
`COUNT(*) FROM rankings WHERE template_id = ?`.

**Caching/state behavior:** `functions/api/templates.js` returns both list mode (`:115-118`) and
detail mode (`:235-238`) with:

```
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

`src/lib/api.js`'s `getJSON` (`:10-17`) calls plain `fetch(url)` with no `cache` option, so the
browser's default caching fully honors that header. `src/App.jsx:29-43` defines a flat
`<Routes>` list with no `<Outlet>`, no `key`-based persistence, and no keepalive wrapper — navigating
from `/discover` to `/template/:id` and back **unmounts and remounts** `Discover`, so its
`useEffect([])` does run again on return. The request is issued; the browser just answers it from
its own HTTP cache instead of going to the network.

## Root Cause

**Confirmed: browser HTTP caching of `GET /api/templates`, not stale component state and not a
server-side data bug.**

Ruled out with direct evidence:

| Candidate | Verdict | Evidence |
|---|---|---|
| Discover component state preserved across navigation | No | Flat `<Routes>`, no `<Outlet>`/`key`/keepalive anywhere in `src/`; `Discover` fully unmounts, its effect re-runs on remount |
| In-flight request dedup map (`src/lib/api.js`'s `inFlightGET`) serving a stale resolved promise | No | The map entry is deleted in a `.finally()` that fires on settle, before the stored promise value can be observed elsewhere — its lifetime is bounded by one network round trip, far shorter than a user's visit to the detail page |
| Cloudflare edge cache | Not the trigger | No `_headers`/`_routes.json`/Cache Rules exist in this repo; more importantly, a hot edge cache would not matter here because the **browser's own cache** short-circuits the request before it leaves the machine |
| Server returning stale data | No | `functions/api/templates.js:50-51` computes Views live via `COUNT(*) FROM template_views`; the origin would answer correctly if asked |
| Service worker / bfcache | No | No service worker anywhere in the repo; this is same-document SPA navigation via `<Link>`, not a full document unload, so bfcache does not apply |

**Mechanism:** `GET /api/templates?limit=50` is requested with a bare `fetch(url)`, which respects
`Cache-Control: public, max-age=60, stale-while-revalidate=300`. Discover always requests the exact
same URL. Within 60 seconds the browser serves the cached body with zero network activity. For the
next 300 seconds (`stale-while-revalidate`), the browser serves the **stale** cached body
immediately and only revalidates in the background — so even the *next* back-navigation after the
fresh window can still show the old number. Worst case, a stale view count can persist for roughly
360 seconds.

This exact risk was already flagged and accepted as unresolved during the prior row-read
optimization work: `docs/row-read-optimization-plan.md` lists *"client-cache staleness after
mutations"* as a known Pass-1 risk that "still applies unchanged." This ticket is that risk
materializing for the Views metric specifically.

**Why Template Detail does not show the same symptom:** it deliberately reads `views` from the POST
response (`TemplateDetailPage.jsx:239-241`), and `POST /api/templates` carries no `Cache-Control`
header at all (`templates.js:284` passes no headers argument), so it is never cached.

## View Tracking Rules

Verified against the current implementation and the live database — **already correctly
implemented, no change required here:**

- First view by a given account for a given template → Views +1.
- Repeat view by the same account → Views +0.
- A different account viewing the same template → Views +1 for that template, independent per
  account.
- Viewing a template never changes Uses.

Enforcement is at the **database** level, not merely in frontend logic: `schema.sql:91-96` declares
`template_views` with `PRIMARY KEY (template_id, user_id)`, and the write path
(`functions/api/templates.js:266-272`) performs `INSERT OR IGNORE` inside a `db.batch()` together
with a counter recompute from `COUNT(*)`. Two concurrent view-recording requests for the same
`(template_id, user_id)` pair serialize on the primary-key constraint; the request that loses the
race gets `meta.changes === 0` and is correctly reported as `counted: false`. There is no
read-then-write window where a race could double-count. The frontend's `currentUser ? ... :
Promise.resolve(null)` check (`TemplateDetailPage.jsx:234`) is a policy decision to exclude guests,
not the deduplication mechanism itself — the mechanism is the database constraint. Anonymous/guest
views are deliberately not counted, matching "when an **account** views."

`recordTemplateView` (`src/lib/api.js:299-311`) has exactly one call site in the entire frontend
(`TemplateDetailPage.jsx:234`). Every other consumer of template data (`Discover.jsx`,
`PopularTemplates.jsx`, `HashtagDetail.jsx`, `HomeRightSidebar.jsx`, `RankTierList.jsx`,
`PostDetail.jsx`/`AboutTemplateCard.jsx`) only issues `GET` requests.

## Use Tracking Rules

Also verified as already correct:

- Creating a tier list from a template (`POST /api/rankings`) → Uses +1.
- Creating a tier list never touches `template_views` and never changes Views.
- Uses and Views are computed from fully disjoint tables and disjoint write paths.

`functions/api/rankings.js`'s ranking-creation branch inserts into `rankings` and updates the legacy
`templates.use_count` mirror; it contains no reference whatsoever to `template_views` (confirmed by
exhaustive search — zero matches). Critically, the "Use Template" button's destination,
`src/pages/RankTierList.jsx:54-86`, loads the template via `fetchTemplate(templateId, { light: true
})` — a `GET` request — and never calls `recordTemplateView`. So a user who clicks "Use Template"
directly from a Discover card and publishes a tier list without ever opening the template's detail
page gets exactly `+1 use, +0 views`. This is correct per the stated rules, and it is one of the
reasons Views can legitimately be lower than Uses (see next section).

**Why Views is currently much lower than Uses is not a bug.** Investigated the live local D1
database directly: `template_views` holds 15 rows contributed by only 3 real user accounts, while
`rankings` holds 633 rows, of which 625 belong to synthetic community-seed accounts.
`scripts/gen-community-seed.mjs` bulk-inserts `rankings` rows to populate Uses but contains zero
`template_views` inserts (confirmed by exhaustive search). Since both metrics now read live
`COUNT(*)` from their respective tables, Uses is reading a fully-seeded table while Views is reading
a table containing only genuine human page-opens from the current test accounts — roughly a 42:1
ratio that is fully explained by data provenance, not by any tracking defect. Three structural
factors reinforce this in the intended, organic-traffic direction: views are capped at one per
account forever while uses are not capped at all; guests are never counted toward views; and the
"Use Template" path from Discover records a use without ever recording a view. As real, organic
account traffic accumulates, Views is expected to exceed Uses, consistent with the stated
expectation. **No code change should force this relationship** — doing so (multiplying, deriving one
from the other, seeding fake views) would make Views stop being an independent, real metric.

## Data Model

No changes needed to the data model; it already supports both required behaviors:

```sql
CREATE TABLE rankings (
  id TEXT PRIMARY KEY, ..., template_id TEXT, ...
);
CREATE INDEX idx_rankings_template_id ON rankings(template_id);
-- one row = one use; COUNT(*) WHERE template_id = ? gives live Uses

CREATE TABLE template_views (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, user_id)
);
-- PK guarantees at most one row per (template, account); COUNT(*) WHERE template_id = ? gives live Views
```

`templates.use_count` and `templates.view_count` remain in the schema as denormalized/legacy
mirrors, already unused for display (list/detail modes both compute live counts instead).

## Proposed Fix

Two changes, addressing the confirmed root cause without touching tracking logic (which is already
correct):

1. **Client-side fresh-view-count overlay in `src/lib/api.js`.** Remember the view count the current
   browser tab already knows to be current — the number returned by its own successful
   `recordTemplateView` POST — and merge it over any (possibly cached) list response before handing
   data to callers. This guarantees the acting user's own action is reflected immediately,
   regardless of any HTTP cache, with zero extra network requests.
2. **Shorten the `/api/templates` cache TTL and drop `stale-while-revalidate`.** Changes
   `max-age=60, stale-while-revalidate=300` (a ~360s worst-case stale window) to `max-age=10` (a 10s
   worst-case window, and no silently-extended staleness) for both list and detail modes. This
   bounds staleness for every *other* user/tab that doesn't benefit from the overlay (a second tab,
   a different account, a page reload that lost the in-memory overlay).

## Discover Refresh Strategy

The overlay is the mechanism that makes Discover show the updated count "without requiring a manual
browser refresh," as required:

```js
// src/lib/api.js
const freshViewCounts = new Map(); // template_id -> view_count learned from our own POST

function rememberViewCount(templateId, viewCount) {
  if (templateId == null || viewCount == null) return;
  freshViewCounts.set(templateId, viewCount);
}

function applyFreshViewCounts(result) {
  if (!result?.data || freshViewCounts.size === 0) return result;
  // Build new objects — getJSON hands the same parsed object to concurrent callers,
  // so mutating it in place would leak across every other consumer of that response.
  const data = result.data.map((t) => {
    const fresh = freshViewCounts.get(t.id);
    if (fresh == null) return t;
    if (fresh <= (t.view_count ?? 0)) {
      // Server has caught up (or overtaken, e.g. someone else also viewed it) — stop overriding.
      freshViewCounts.delete(t.id);
      return t;
    }
    return { ...t, view_count: fresh };
  });
  return { ...result, data };
}
```

`recordTemplateView` calls `rememberViewCount(template_id, json.views)` right after a successful
POST. `fetchTemplates` (list mode) returns `applyFreshViewCounts(await getJSON(url))`.

Because views are monotonically non-decreasing, "the larger of the two numbers" is always the
fresher one, the entry self-deletes the moment the server catches up, and the map cannot grow
unbounded or pin a permanently wrong value.

This is deliberately **not** a new state-management library, not React Query/SWR, and not a global
store — it is a small, plain module-level `Map` colocated with the existing `inFlightGET` map in
the same file, following the file's existing pattern.

## API Changes

None to request/response shapes. Only the `Cache-Control` header value changes on
`GET /api/templates` (both list and detail modes):

```
'public, max-age=60, stale-while-revalidate=300'  →  'public, max-age=10'
```

`functions/api/hashtags.js`'s cache header is untouched — unrelated to this bug.

## Frontend Changes

`src/lib/api.js` only:
- Add the `freshViewCounts` map, `rememberViewCount`, and `applyFreshViewCounts` helpers.
- `recordTemplateView`: call `rememberViewCount` after a successful response.
- `fetchTemplates`: wrap its return value through `applyFreshViewCounts`.

No changes to any page/component — `Discover.jsx`, `TemplateCard.jsx`, `PopularTemplates.jsx`,
`HashtagDetail.jsx` continue to read `template.view_count` exactly as before; the correction happens
transparently inside the shared API layer all of them already call through.

## Database Changes

**No database migration is required.** The existing `template_views` primary key already enforces
one-view-per-account, and `rankings.template_id` (with its existing index) already supports live
Uses counting. Both required behaviors are fully supported by the current schema.

## Performance Considerations

| | Before | After |
|---|---|---|
| Extra API requests introduced | — | none |
| Extra database writes introduced | — | none |
| `/api/templates` cache TTL | 60s, extended to ~360s by `stale-while-revalidate` | 10s, no extension |
| Staleness window for the user who just recorded the view | up to ~360s | 0s (overlay) |
| Staleness window for other tabs/accounts | up to ~360s | up to 10s |

No N+1 queries are introduced — the underlying SQL query is unchanged (a single query per request
using the two existing covering-index subqueries from the prior fix). The only added cost is more
frequent origin hits due to the shorter cache TTL, bounded to at most once per 10 seconds per unique
query string, and further reduced within any short burst by the existing `inFlightGET`
deduplication in the same file.

## Edge Cases

| Case | Behavior |
|---|---|
| First view by an account | POST inserts a new row, `counted: true`; overlay immediately reflects the new count on Discover |
| Repeat view, same account | `INSERT OR IGNORE` no-ops, `counted: false`, no change |
| Different account views the same template | Independent +1, unaffected by the first account's view |
| Use without viewing | Uses +1, Views +0 — the `/rank` flow never calls `recordTemplateView` |
| View without using | Views +1 (first time), Uses +0 |
| Multiple rapid view requests (same account) | Serialized by the `template_views` primary key; exactly one is counted regardless of request timing |
| Browser back navigation to Discover | Overlay supplies the fresh number even if the underlying GET response is served from cache |
| Direct navigation to Template Detail | Behaves exactly as today — POST result overrides the page's own display |
| Refreshing Template Detail | Each mount re-runs the effect; dedup at the database keeps the count from double-incrementing |
| Refreshing Discover (full page reload) | The in-memory overlay is lost with the page, but the 10s TTL means the server's own number is already current within 10 seconds |
| Anonymous/guest users | Not counted, per existing policy gate — unaffected by this fix |
| Deleted templates | An overlay entry for a deleted template simply never matches again; the map only grows with templates actually viewed in the current tab session |
| Invalid template IDs | `recordTemplateView`/`onRequestPost` already validate `template_id`/`user_id` presence and return `400` on missing fields; unaffected by this fix |
| Cached Discover responses | This is precisely what the fix addresses — see Root Cause and Discover Refresh Strategy |

## Verification Plan

No test runner exists in this project. Verification is via direct API calls against a local
`wrangler pages dev` instance, followed by a manual browser pass, with all test data cleaned up from
local D1 afterward.

1. Discover (or a direct `GET /api/templates?limit=50`) starts with a known Views value for a chosen
   template.
2. Open that template's detail page — confirm `POST /api/templates` returns `counted: true` and
   `views` incremented by 1.
3. Confirm the detail page displays the incremented value (already working prior to this fix).
4. Immediately re-fetch `GET /api/templates?limit=50` from the same client session — the response
   returned to application code must show the incremented value even if the raw HTTP response is
   served from cache, proving the overlay works.
5. Confirm the response's `Cache-Control` header is now `public, max-age=10` (no
   `stale-while-revalidate`).
6. Open the same template again with the same account — `counted: false`, Views unchanged.
7. Create a tier list from the template (`POST /api/rankings` with that `template_id`) — Uses
   increases by exactly +1.
8. Re-fetch the template — Views is unchanged by step 7.
9. Open the template with a different account — Views increases by exactly +1, independent of the
   first account's prior view.
10. That second account creates a tier list from the template — Uses increases by exactly +1, Views
    unchanged.
11. Send several rapid duplicate view POSTs for one account/template pair — confirm only one is ever
    counted (no duplicate view rows, no double-increment).
12. Confirm Uses and Views moved independently throughout steps 2–11 — neither metric ever changed
    as a side effect of the other.
13. Confirm Discover, Popular Templates, and Template Detail all display the same Uses/Views for the
    same template after the above sequence.
14. `npm run lint` passes with no new warnings.
15. `npm run build` passes.
16. Manual browser pass (only with the user's explicit go-ahead to open a browser): reproduce the
    original repro steps — Discover shows Views = 0, open the template, detail shows 1, navigate
    back, Discover now shows 1 without a manual page refresh.
17. Clean up any test rows created in local D1 (`rankings`, `template_views`) and confirm affected
    templates' counts are restored to their pre-test values.

## Implementation Steps

1. Write this plan document.
2. `src/lib/api.js`: add `freshViewCounts`, `rememberViewCount`, `applyFreshViewCounts`; wire
   `rememberViewCount` into `recordTemplateView` and `applyFreshViewCounts` into `fetchTemplates`,
   preserving immutability throughout.
3. `functions/api/templates.js`: change the `Cache-Control` header on both list mode and detail mode
   to `public, max-age=10`.
4. Run the API-level verification (steps 1–13 above) against a local `wrangler pages dev` instance.
5. Clean up all test data created in local D1.
6. `npm run lint`, `npm run build`.
7. Ask the user before performing any browser-based verification; if approved, run the manual pass
   (step 16) and close any opened tabs afterward.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Overlay pins a stale or wrong number indefinitely | Structurally impossible: the merge rule deletes the entry the moment the server-reported count reaches or exceeds it, and view counts are monotonically non-decreasing, so the larger value is always the correct one to prefer in the interim. |
| Mutating the shared parsed response object causes cross-page data leakage | `getJSON`'s in-flight dedup map hands the identical parsed object to every concurrent caller of the same URL; `applyFreshViewCounts` is written to only ever construct new objects/arrays and never mutate `result` or `result.data` entries in place. |
| Shortening the cache TTL meaningfully increases database load | Bounded and quantified above: no new query shape, same single query with covering-index subqueries from the prior fix, requests capped at once per 10 seconds per unique query string, further reduced by the existing in-flight request dedup. Revisit if template count or Discover traffic grows substantially. |
| Removing `stale-while-revalidate` adds a small latency hit once every 10s instead of serving instantly-stale data | Deliberate: `stale-while-revalidate` was the mechanism that extended real-world staleness to ~360 seconds; the underlying query is fast at current data volumes, so the latency cost of an occasional live fetch is preferred over prolonged staleness. |
| A future change tries to "fix" Views being lower than Uses by deriving one from the other | This plan documents the seed-data provenance explanation in detail specifically so this asymmetry is not mistaken for a defect by a future reader; the verification plan explicitly checks that the two metrics move independently. |
| Scope creep into the legacy `use_count`/`view_count` mirror columns or the tracking logic itself | Explicitly out of scope — both are already functioning correctly per Step 3/Step 4 of the investigation; this fix touches only the cache header and the client-side read path. |

# Hashtag catalog cache freshness — fix report

## Root cause
`GET /api/hashtags` builds tags live from `templates.hashtags` (recursive split + `COUNT(DISTINCT tid)`), which is correct — no persistent `hashtags` table created. The staleness came only from the Cache API:
- browse with `q=''` returned `public, max-age=300` (functions/api/hashtags.js:158)
- the sidebar client kept a per-tab cache of `300 * 1000 ms` for the `limit=5, sort=popular` request (`src/components/feed/HomeRightSidebar.jsx:16`)
- no version bump on cache keys and no wildcard invalidation exists across the many query variants (page/limit/sort/q/suggest)

After deleting a template (creator/admin/orphan auto-delete), the live query immediately returns the correct counts/tags, but cached responses lingered for up to 5 minutes. No long-term client in-memory cache outside the small sidebar in-flight cache (which respects TTL and is tab-scoped) — `src/lib/api.js`'s `inFlightGET` deduplicates concurrent GETs but does not persist across navigations; Discover/PopularHashtags refetch on param changes.

## Changes made
### Server (`functions/api/hashtags.js`)
- Added `CATALOG_CACHE_VERSION = 'v2'` and included `catalog=v2` in the cache key normalization (before `sort()`). Because Cache API keys are full URLs, this version bump forces a global invalidation on deploy (no prefix wildcard possible). The `catalog` param is internal-only and not a filter.
- Unified all responses to `public, max-age=30` (was `q ? 30 : 300`). Applies to browse (`q=''`), search (`q!==''`), and suggest (`suggest=1`). Uniform 30s bounds worst-case stale to ≤ 30s while `waitUntil` still writes the cloned response to Cache API.
- Added `HAVING COUNT(DISTINCT tid) > 0` to both the suggest CTE and the main browse CTE. The live query should not emit rows with `content_count=0` by construction, but this is a defensive guard that prevents orphan zero-count tags from ever appearing in any variant (addresses requirement 3: “do not leave hashtags with content_count=0”).

### Client (`src/components/feed/HomeRightSidebar.jsx`)
- Updated sidebar hashtag cache TTL from `300 * 1000` to `30 * 1000` to stay ≤ the endpoint's freshness (and match the new policy). Templates TTL remains 10s. The sidebar's `sidebarCache` is module-level but per-tab, keyed by the exact query, and overwritten by server `Cache-Control` semantics (it never exceeds endpoint freshness).

### Tests (`tests/local/hashtags-only.mjs`)
- Made the schema parity check ignore additive columns introduced after the hashtag migrations (e.g. `last_activity_at` on `rankings`) so the existing transition test continues to validate only the intended column changes (`category` removal). No behavioral change to the migration assertions beyond that tolerance.

## New test
`tests/local/hashtag-catalog-staleness.mjs` — end-to-end coverage of A–H and cache staleness:

- **A/B/F/G/H**: create templates T1 (#food), T2 (#food,#thai). `#food` = 2, `#thai` = 1, total=2, no zeros. Delete T1 → `#food`=1, `#thai`=1. Delete T2 → both gone from browse; `?q=food` returns empty (F); `suggest=1` returns empty (G); total 0 (B/H). Pagination/total consistent after deletions (H).
- **C**: multi-tag template `#food,#thai` removed → `#food` disappears (only source), shared `#thai` count drops correctly, untouched tags unchanged.
- **D**: orphan template auto-delete — owner deletes last ranking of a template; template is removed via `templateDeleteStatements()` (shared path) and the catalog reflects it immediately (`#food` disappears, shared `#thai` unchanged). This matches the rankings DELETE flow in `functions/api/rankings.js:1104–1114`.
- **E**: admin template delete (`/api/admin/templates` POST `action: 'delete'`) uses the same `templateDeleteStatements()` and updates counts identically.
- **CACHE**: with a fake `caches.default`, first browse populates cache with `catalog=v2` key and `max-age=30`; after a template delete, forcing the cached entry to expire (`X-Catalog-Expires='1'`) produces a fresh read showing the new counts. Asserts `Cache-Control: public, max-age=30` on the cached hit.

## Verification (all green, no commit)
- `node tests/local/hashtag-catalog-staleness.mjs` → all A–H + CACHE passed
- `node tests/local/hashtags-only.mjs` → passed (parity check updated)
- `node tests/local/ranking-orphan-template-delete.mjs` → passed (uses same shared delete path; catalog behavior unchanged)
- `node tests/local/trending-recent-activity.mjs`, `trending-pool-cache.mjs`, `ranking-atomicity.mjs`, `cold-feed-reads.mjs`, `verified-session-mutations.mjs`, `comment-self-delete.mjs` → all passed (regression suite)
- `npm run lint` → 0 errors / 4 pre-existing warnings (unchanged)
- `npm run build` → successful

## Quota/notes
- Reducing browse TTL from 300s to 30s increases catalog re-fetch frequency under heavy traffic; the change prioritizes **correctness** (delete → catalog reflects within ≤30s, and immediately after expiry/cache miss) over extra caching. The recursive CTE is the same query shape (indexed via templates table access; no new persistent table). If this proves heavy in prod, a versioned/tag-based cache invalidation could be introduced later without changing the live source-of-truth (templates.hashtags). No `VITE_*`/dotenv changes, no schema changes.
- The solution does not create a separate hashtag table (as required). Source of truth remains `templates.hashtags` and the live GROUP BY over the recursive split, with `HAVING content_count > 0` guaranteeing no zero-count tags ever leak into responses.
- Delete paths already shared: `templateDeleteStatements()` is used by creator delete (`template-delete.js`), admin delete (`admin/templates.js`), and orphan auto-delete (`rankings.js` when owner removes last ranking of their template) — all benefit from identical semantics and the same catalog staleness bound (30s).
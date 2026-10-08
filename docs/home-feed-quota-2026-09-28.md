# Home Feed D1 quota optimization — 2026-09-28

**Release update:** A schema-compatible variant is now deployed. Migrations 0024/0025 remain unapplied after automatic approval review rejected them. See [the release report](home-feed-deployment-2026-09-28.md) for the actual deployed mode and its 6,550/2,611/2,567 cold-read benchmark; the lower figures below describe the indexed, reconciled-mirror mode.

Implemented against `a3f195acf79caf4ec4dc9537d2067af18d970518` on `codex/project-audit-fixes`. No production data was deleted. Remote migrations remain unapplied; deployment status is recorded above.

## Measured D1 reads

Real `meta.rows_read` from local Miniflare D1, invoking the actual rankings handler. Both versions use the existing `quota-hot-paths.mjs` fixture unchanged: 2,000 rankings, 40,000 placements, 10 templates, the same viewer/votes/follow/topic data. Batch size is **12**. Each mode starts with an empty cache; warm repeats page one; next requests page two (cursor in the new version). Guest warm changes seed to prove cache sharing.

| Feed | Cold before → after | Warm before → after | Next page before → after |
|---|---:|---:|---:|
| Trending, signed in | 73,696 → **242** | 557 → **13** | 17,854 → **193** |
| For You | 62,012 → **254** | 1,517 → **16** | 27,460 → **193** |
| Following | 62,257 → **210** | 1,760 → **30** | 19,058 → **208** |
| Guest Trending | 69,695 → **229** | 17,854 → **0** | 4,554 → **180** |

Cold reads fell by 99.59–99.67%. These are handler measurements, not a production billing forecast: authenticated session middleware, notifications, bookmarks, sidebars, analytics and Post Detail are outside this measurement. Cache API is local to each Cloudflare data center; cold requests in another data center still perform bounded reads. Single-flight coalescing is per Worker isolate, not a global lock. A cold concurrent burst of 10 identical guest requests was verified to issue one candidate query and 12 card queries in total.

Raw evidence: [before](benchmarks/home-feed-2026-09-28/before.json), [after](benchmarks/home-feed-2026-09-28/after.json), [EXPLAIN](benchmarks/home-feed-2026-09-28/index-plans.json). Reproduce the new result with:

```powershell
node tests/local/home-feed-benchmark.mjs .wrangler/audit-logs/home-after.json
```

The baseline was captured before modifying the handler/indexes. Do not run `--index-experiment` against the updated schema to reconstruct a pre-index baseline: the original plans are retained in the evidence above.

## Root cause and replacement

The largest old Trending query was the community histogram: **67,524 rows** for `GROUP BY r.template_id, ri.item_id, ri.tier` across `ranking_items`. Candidate selection read 4,000 rows and the live template-use aggregation read 1,615. The old 600-ID pool and full placement reads amplified every page; the community cache lived only five seconds.

`functions/lib/home-feed.js` now serves unfiltered Home requests. Explicit author/template/hashtag/sort lists keep their compatibility path; Post Detail retains complete placements and community pages retain their explicit aggregate APIs.

- Trending reads a bounded activity-index window of 49 rows, retains 48 candidates, then ranks that window in memory. Shared candidate cache: 60 seconds. The cursor carries the remaining IDs and next keyset boundary; scrolling through a pool does not query candidates again. Guest seeds/fresh flags do not fragment the shared response cache (30 seconds) or candidates.
- For You reuses a 48-ID snapshot across pages. Interests are cached for 300 seconds and bounded to 24 own rankings, 24 likes and 50 followed topics. Topic queries seek each existing `(user_id, topic_type, created_at)` index range. Sparse interests scan at most four indexed candidate windows (196 rows) once per pool, not once per 12 cards. No-interest fallback uses a bounded recent window.
- Following has no candidate pool. It seeks at most 13 rows per followed author via the existing user/created/id index, merges those bounded heads and returns 12 with a cursor. Cost grows with the number of followed authors; thousands of follows will cost more than the one-follow fixture.
- Cards read at most 12 placements via a per-ranking preview index and indexed item lookups. Shared card cache: 30 seconds. No Home placement histogram or live template-use COUNT. Community Disagreement is omitted on Home and remains available on its detail/community surfaces.
- The existing `templates.use_count` is the denormalized Home counter. Migration 0025 reconciles historical drift once; transactional owner/admin ranking deletion and admin user deletion now maintain it. Ranking and duel creation already increment it transactionally. No new feed table or write-heavy preview JSON mirror is necessary for the measured cold budget.
- Viewer votes/follow state are overlaid after public cache reads, never stored in shared responses. Signed-in responses remain `private, no-store`. Malformed and cross-viewer cursors return 400. Deep page-number requests require `nextCursor`; no deep OFFSET is introduced.
- Trending ranking is now local to each 48-candidate activity window, rather than a global 600-row sort. This intentional bounded selection changes which equally eligible posts appear first. Activity changes/new posts can move across a keyset boundary; the client deduplicates IDs and refresh starts a fresh snapshot. A currently exhausted feed terminates normally instead of appending artificial recycled cards forever.

## Frontend and regressions

`PAGE_SIZE` remains 12. All three tabs use `VirtualFeedContainer` with a 12-card window and three preceding buffer cards. Fetching is based on viewport distance, not the rendered overscan. The observer/scroll guard coalesces concurrent triggers; new batches update the current viewport immediately so a user paused at the old bottom does not see an empty spacer.

Cursor, generation guards and per-tab cached state prevent old responses from overwriting a newly selected tab. For You no longer issues a second fallback request from the client. No Home polling was added. Notifications have their separate existing polling policy.

Like results update both the mounted card and retained feed/tab caches, preserving the vote after virtual unmount/remount. Home only renders previews: opening a ranking, Comments, Share or Export navigates to Post Detail; Share/Export opens the corresponding modal there after loading the full ranking. This avoids silently exporting a truncated preview. Post Detail also preserves the API profile/follow state during its data mapping.

Public card counters may lag by up to 30 seconds, candidate selection by 60 seconds and For You interests by 300 seconds. The current user's successful Like update is reflected immediately in the client. These bounded cache freshness tradeoffs replace repeated global aggregation.

## SQL and deployment steps — not executed remotely

Reviewed migrations 0012 (Following/creation indexes), 0013 (ranking/tier/item aggregate index), 0019 (activity column). Only two extra indexes are added by **0024_home_feed_indexes.sql**:

```sql
CREATE INDEX IF NOT EXISTS idx_rankings_feed_activity
  ON rankings(COALESCE(last_activity_at, created_at) DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_items_preview
  ON ranking_items(ranking_id, position, id);
```

EXPLAIN before: activity selection scans rankings and uses a temp sort; preview uses the tier index then a temp sort. After: activity uses the ordered index with LIMIT; preview seeks the ranking prefix with no temp sort. Following already uses `idx_rankings_user_created`, so no duplicate index was added. Deep activity boundaries use separate equality/id and older-time seeks: SQLite did not seek this expression index for a tuple inequality. A test with 8,000 equal timestamps verifies fewer than 500 total reads at a deep cursor. Both new indexes add write maintenance; 0013's index remains necessary for non-Home aggregates.

**0025_home_template_use_counts.sql** performs a one-time, indexed reconciliation:

```sql
UPDATE templates SET use_count = (
  SELECT COUNT(*) FROM rankings WHERE rankings.template_id = templates.id
);
```

This changes only the derived counter and does not delete content. Its one-time read/write cost depends on actual database size and is not included in request benchmarks.

Before release: verify production has the prerequisite columns/indexes, deploy the transactional counter maintenance and apply these two reviewed files during the same release window, then deploy the matched frontend/backend build. Apply only the intended files; do not replay unrelated historical migrations. No `--remote` command was run. Indexes are also in `schema.sql` for fresh local databases. Code still runs without 0024, but its measured cold Trending cost without these indexes was about 4,541 reads rather than 242. Correct historical use counts require 0025.

After deployment: sample `component: home_feed` metrics (hits/misses/coalesced/cards/duration; no user IDs), check Cloudflare D1 reads separately for each feed and observe actual presentation traffic. Production multi-region load capacity has not been measured by these local tests.

## Tests and data safety

78 local regression scripts passed, plus the new `home-template-counts.mjs` (79 total). Targeted tests were rerun after subsequent viewport/topic/counter fixes. Tests cover 123 distinct rankings through all three modes beyond the first pool, expired-cache cursors, deletion and concurrent insertion between pages, invalid identity/cursors, full detail versus preview, shared guest cache, concurrent request coalescing, 8,000 tied timestamps, 8,000 viewer votes, transactional creation/rollback, admin deletion, comments, templates, community aggregates and export behavior. `npm run build` passes; `npm run lint` has only the four existing Fast Refresh warnings.

The old filtered-cache/eligibility suites explicitly exercise their retained compatibility route. Obsolete simulated endless recycling was removed from the virtualization test; the new virtual-window test executes the actual component callback bodies rather than relying only on a copied simulation.

Browser verification uses isolated local D1 on port 8799 with synthetic posts (not the user's port 8788 or production). Mobile verification confirms initial 12 cards, additional batches only on reaching the bottom, 12 mounted cards after scrolling in For You and Following, scroll-back state, persistent Like after unmount, full Post Detail and successful comment submission. Further browser checks are recorded below.

`src/data/mockFeed.js` and `FeedProvider.jsx` are already absent in the current checkout; the supplied historical AGENTS note is stale. `tests/fixtures/preview-seed.sql` is synthetic and belongs to Preview isolation tests. Historical `seed.sql`, `templates-seed.sql`, `community-rankings-seed.sql` and `scripts/gen-community-seed.mjs` are coupled by template/item/ranking IDs; rankings further have votes, comments, reports, duels, scores, notifications and current-contribution dependencies. They were not deleted, and production rows cannot safely be classified for deletion by their names alone.

## Changed files

- Backend: `functions/lib/home-feed.js` (new), `functions/api/rankings.js`, `functions/api/admin/rankings.js`, `functions/api/admin/users.js`.
- DB: `schema.sql`, `migrations-active/0024_home_feed_indexes.sql`, `migrations-active/0025_home_template_use_counts.sql`.
- UI/client: `src/pages/HomeFeed.jsx`, `src/pages/PostDetail.jsx`, `src/components/feed/VirtualFeedContainer.jsx`, `src/lib/api.js`, `src/lib/trendingSeen.js`, `src/locales/en.json`, `src/locales/th.json`.
- New tests: `tests/local/home-feed-benchmark.mjs`, `home-feed-cursor-cache.mjs`, `home-virtual-window.mjs`, `home-template-counts.mjs`.
- Adjusted tests: `admin-deletion-counters.mjs`, `cache-observability.mjs`, `cold-feed-reads.mjs`, `quota-hot-paths.mjs`, `trending-pool-cache.mjs`, `trending-virtual-infinite-feed.mjs`.
- This report and `docs/benchmarks/home-feed-2026-09-28/` evidence.

## Final browser evidence

Verified on the completed build at mobile 390×844 and desktop 1440×1000 (client widths 375/1425 after the scrollbar): no horizontal overflow. Fresh mobile Home navigation added exactly **one** `/api/rankings` request in the local server log and mounted 12 cards. Each tab advanced to a virtual range such as indices 7–18 after reaching the previous batch bottom; DOM remained 12 cards. Like stayed selected with count 1 after the card was unmounted and remounted. Comments submission and persisted count 1 passed. Template detail loaded its items, community rankings and cooldown UI. Post Detail now shows Following correctly. Home Export navigates to Post Detail and displays the full export preview/modal; its click-event serialization error was fixed and covered by a regression assertion.

Mobile Home

Desktop Home


> Screenshot captures and local visual-audit artifacts were removed before publishing this repository. The implementation findings above are retained.

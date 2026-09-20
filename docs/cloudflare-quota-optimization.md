# Quota optimization — 2026-09-21

Deployed to production: see [deployment checkpoint](deployment-quota-2026-09-21.md).

| Waste | Change | Savings / trade-off |
|---|---|---|
| Notification list sorts every notification for a user | Merge the latest read/unread groups using the existing index | Local D1 fixture (2,000 notifications), limit 20: **4,000 → 61 rows read**. Identical ordering/payload; no new index writes. Unread COUNT still reads unread entries. |
| Repeated mark-read updates | Update only unread rows | Repeated read actions write zero rows; behavior unchanged. |
| Every hashtag request repeats recursive aggregation; signed-in browse also checks session | Public Cache API response cache, bypass session for the public catalog | Warm cache: zero D1 queries. Browser cache avoids repeat Worker requests. Browse TTL 300s, search/suggestions 30s; results can lag by that duration. Edge hits still invoke Workers. Cache failures fall back to D1. |
| Empty first search page repeats the aggregate for total | Infer total=0 on empty first page | Two queries → one; later out-of-range pages retain exact totals. |
| Analytics day join converts every stored timestamp; retention has no time-leading index | UTC range predicates and created_at index | Local fixture: **2,000 → 11 rows read** for one day, identical count. Retention gets an indexed range. Costs one extra index entry per event and index storage. |
| UUID-named R2 uploads lack explicit browser caching | One-year immutable Cache-Control metadata | Repeat browser loads avoid R2 reads. Applies to new uploads only; cached copies can survive object deletion. URLs are never overwritten. |
| Item joins resolve by ID OR name, but name is unindexed | Add non-unique `idx_items_name` | Local D1: 26 template items against 5,002 catalog rows: **130,078 → 65 rows read**. Preserves duplicate names, ID/name collisions and missing-item behavior. Adds index storage and an index write per catalog insert/name change; normal ranking publication does not write this catalog. |
| Template reaction totals scan the same votes twice | Conditional aggregation in template detail and reaction GET/POST | 1,000 reactions, authenticated GET: **2,001 → 1,001 rows read**. Empty totals and vote mutation responses preserved. No new index or freshness trade-off. |

Apply `migrations-active/0011_quota_indexes.sql` through the existing staged migration process before deployment. It is additive/idempotent; fresh databases get the index from `schema.sql`.

`0011` includes both `idx_analytics_created` and `idx_items_name`; both are now applied and verified in production. [Deployment steps](quota-deployment.md) are retained for reference; `wrangler.quota.toml` discovers only this file and excludes `0010` and historical migrations.

Already fine: feed GET deduplication, trending/spotlight caches, lazy profile similarity, per-session template-view tracking, hidden-tab polling suspension, debounced search, direct R2 image URLs. No KV, Durable Objects, cron, or queues are configured. Static assets have no matching Functions handlers; retain Pages' generated routing. Metadata Functions preserve social previews.

Deliberately retained: fresh authorization checks, password hashing strength, exact analytics event collection, live template counts (stored counters can drift), personalized-response no-store. No paid service added.

Validation: `node tests/local/quota-optimization.mjs` exercises D1 response equivalence/read counts, public-cache expiry/alias/session bypass/failure fallback. Existing security-headers, maintenance-read-only, hashtags-only, admin-dashboard-queries and notification-polling checks passed. Build passed; lint passed with four existing React refresh warnings. Measurements are synthetic local D1, not production traffic or measured Worker CPU.

Follow-up: `node tests/local/quota-item-reactions.mjs` verifies both new optimizations, migration reapplication, ID/name collisions, duplicate names, missing items, guest/authenticated/empty totals and vote switch/cancellation. Template-discover-preview, verified-session-mutations and profile-similar-lazy passed. Pages Functions compiled; generated routes include only `/api/*`, `/rank`, `/template/*`, `/post/*`, `/compare/*`. No new Worker-request or R2-operation reduction is claimed for this follow-up.

Cloudflare references: [D1 row accounting](https://developers.cloudflare.com/d1/platform/pricing/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Pages routing](https://developers.cloudflare.com/pages/functions/routing/).

## Measured hot-path follow-up

Fixture: 2,000 rankings, 40,000 placements, 10 templates; 12 posts/page. Handler-only D1 measurements exclude the unchanged session lookup.

| Path | Before: rows read / written per request |
|---|---|
| Trending, cold pool | 73,386 / 0 |
| For You | 67,999 / 0 |
| Following | 61,987 / 0 |
| Template list | 2,069 / 0 |
| Notification poll, 500 unread | 562 / 0 |
| New analytics event | 0 / 6 |

The largest component was community placement aggregation: 58,812–67,214 reads per page. Added a five-second Cache API cache per template for public use counts and placement histograms. Different pages/viewers share aggregates; personalized pools, votes, follows and authorization are still queried normally. Just-published pinned requests bypass this cache. Cache outages fall back to the original SQL.

For You: **67,999 → 7,774 reads**, **8 → 6 queries**, on an aggregate-cache hit (60,225 reads saved, 88.6%). No reduction in Worker request count or analytics writes. Fresh counts/disagreement can lag by at most the five-second cache lifetime; misses add Cache API overhead. No migration beyond the already-pending `0011`.

`node tests/local/quota-hot-paths.mjs` measures each handler and checks cache-hit equality, overlapping pages, cross-viewer response isolation, fresh bypass, expiry and cache failures. `--compare` optionally compares an ignored pre-change handler snapshot in `.wrangler/quota-rankings-baseline.js`.

`node tests/local/quota-hot-paths.mjs --cpu` bundles the real handler into local workerd, seeds local D1, and profiles 40 requests per condition using the V8 Inspector Profiler (100µs requested sampling interval). Sample intervals attributed to `(idle)`, `(program)` and `(root)` are excluded. One run estimated **36.245ms uncached → 17.730ms cached per request**. These are local sampled active-time estimates, not exact CPU billing or a production Free Tier guarantee; development D1/RPC, sampling, scheduling and profiler overhead affect them. Both conditions run the current code, with the uncached condition forcing fresh aggregate reads. Do not interpret SQL latency as Worker CPU.

Polling cadence, per-event analytics writes and candidate selection remain unchanged: measured costs were lower; reducing analytics events would change reports. An attempted candidate-filter shortcut saved only 180 reads/request and was discarded as low impact.

CPU methodology references: [Cloudflare CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/), [CPU versus wall time](https://developers.cloudflare.com/workers/platform/limits/).

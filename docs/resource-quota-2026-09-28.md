# Additional D1 reductions, 2026-09-28

Base commit: `8980336dc1155bba434a8a85a99094e0c1b5c367`.

## Changes

- `functions/api/templates.js`: shared public catalog response cache (10 seconds for lists, 60 for suggestions). Authenticated users reuse public data then query their own bookmarks. Saved lists and detail remain live. Personal responses remain private/no-store. Explicit no-cache/no-store requests bypass the shared cache. Existing client view-count overlays still apply after recording a view.
- `functions/lib/public-response-cache.js`: expiration check, remaining HTTP TTL, bounded per-database in-flight coalescing, independent response bodies and graceful cache failure. Failed responses are not cached. No cookies or authorization headers enter internal keys.
- `functions/api/activity.js`: select the newest events first, then join template/profile/card details only for that bounded set. Auth, 90-day window, limits, tie ordering and response shape are preserved. No additional cache staleness for Activity.
- `tests/local/catalog-activity-quota.mjs`: measurements and regressions for user isolation, fresh bookmarks, saved-only access, search, suggestions, pagination, 100-card bind limit, expiry, explicit bypass, unavailable cache, concurrent cold requests and Activity ordering.

## Measurements

Local Miniflare D1 `meta.rows_read`, same fixture for old/new handlers: 10 templates, 2,000 rankings and 2,000 votes. Excludes authentication middleware, other requests and production billing. Baseline source snapshots are in ignored `.wrangler/quota-baselines/`; `--compare` uses them. Normal test execution does not require them.

| Request | Before | After |
| --- | ---: | ---: |
| Template list, cold guest | 2,069 | 2,069 |
| Template list, warm guest | 2,069 | 0 |
| Template list, warm authenticated | not separately measured | 11 |
| Activity, 20 events | 22,002 | 10,122 |

Ten concurrent cold catalog requests run one public query batch in the same isolate/database binding. Cross-isolate cold requests can still duplicate work. Edge caches are local to a data center; they are not one global cache. See [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Scope and remaining costs

Home's previously implemented candidate/card caches and infinite scroll remain unchanged. Hashtags and spotlights already have shared caching. Notification and admin polling already stop when hidden/inactive and prevent overlapping requests; visual timers in FreshnessHub do not themselves query D1.

Cold template popularity/view sorting still counts live data; trusted precomputed counts require reconciliation, not blindly reading seeded mirrors. Detail community averages and admin participant exports read the underlying data needed for their output. Activity still scans qualifying recent events before selecting the top set. These costs grow with data and have not been represented as zero or constant. Adding posts creates writes and can increase cold aggregate reads; adding static UI code does not inherently add D1 reads.

No SQL migrations or indexes were added, no remote migrations applied and no production data deleted. Deployed on user authorization to production: https://d3e12315.tear-of-god.pages.dev (canonical https://tear-of-god.pages.dev). Previous deployment for rollback: `f02388f4-4c4a-40e5-a7c9-c5a7fd7f3648`.

Post-deploy read-only smoke checks passed for canonical/deployment HTML and assets, auth, guest Trending cold/warm and cursor page with no duplicate IDs, guest For You, Following guest lock, full Post Detail, template list, hashtags and admin guest denial. Production authenticated interactions were not exercised by this smoke check.

## Verification

`node tests/local/catalog-activity-quota.mjs --compare` passes with identical old/new public catalog and Activity responses. Vite build, Worker compilation and lint pass (four existing Fast Refresh warnings).

Full local script-suite results: 81 passed, 2 failed, recorded in `.wrangler/audit-logs/resource-tests.json`. The historical `migration-baseline-rehearsal.mjs` currently fails its initial assertion that the active directory contains exactly migrations 0001 and 0002; the directory now contains through 0025. Its source and migration configuration were not changed by this pass. `test-browser-home.mjs` failed connecting its Chrome CDP runtime (unsettled await at Runtime.enable), so this run does not establish browser E2E coverage. This failure does not establish that a remote migration is safe; none was attempted.

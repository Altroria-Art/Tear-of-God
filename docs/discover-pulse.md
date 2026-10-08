# Discover Pulse

Discover defaults to **Popular**, with **New** and **Active** tabs. Popular/New request eight catalog topics; they remain usable when Pulse has no recent activity. Active keeps Pulse template order and hydrates full metadata for the shared compact cards. Its time selector uses the windows below and shows the effective fallback period. A compact Community Pulse strip above the tabs links to up to three current conversations/topics and disappears when empty. Hashtag interest links sit above the grid. Search and Saved Templates have a separate paginated results view; full catalogs remain available through View All and More Interests.

`discover-quiet-fallback-regression.mjs` executes the current page effects with controlled API responses: quiet Popular/New, loading, errors, retry, empty success, stale tab responses and Active ordering. Children are shallow elements, so this is behavior/structure coverage, not browser layout verification.

## Data and windows

`GET /api/discover-pulse?window=now|today|week|last_week` is public and read-only. Its windows are rolling UTC intervals: 6 hours, 24 hours, 7 days, and the preceding completed 7-day interval `[now−14d, now−7d)`. The response includes both the requested and effective window. NOW falls back to TODAY when it has no eligible rankings; TODAY falls back to THIS WEEK on the same condition. No activity is invented to fill a section. Empty sections are omitted.

Two indexed queries take at most 40 newly created and 40 recently active rankings. After deduplication, comment and retained-vote counts are queried only for those candidate IDs and only inside the selected interval. Up to 80 template/profile rows are hydrated. The four leading templates get up to four real item names each through indexed preview queries. The response contains at most 5 topic cards, 4 active rankings, 4 discussions, 12 hashtags and 4 active templates. Topic and template counts are measured within this bounded sample; `sampled: true` describes sampling in the API response, not an exhaustive community count. The Pulse endpoint does not call catalog/feed endpoints; the current Discover UI separately calls the catalog for Popular/New and metadata for Active cards.

Activity signals count new rankings, comments and retained votes created in the selected window. A ranking's persisted `last_activity_at` contributes one signal only when no creation, current comment or retained vote is available in the window. Ranking and reaction counts are never taken from all-time mirror counters. The section is called **Active in this window**, since the endpoint does not compare against a prior period and cannot justify a “Rising” label or a growth percentage.

Ordering gives the newest qualifying activity up to 40 points. Recent comments add at most 10, new rankings at most 6, retained reactions at most 4, and distinct active rankings at most 5. This caps engagement so old totals cannot dominate a current window. Discussion cards are ordered by recent comment count, then latest activity.

## Cache and rollout

The endpoint uses the existing public response cache with one canonical key per window, without cookies or viewer fields. TTL is 120 seconds for NOW, 300 for TODAY, 600 for THIS WEEK and 1800 for LAST WEEK. Explicit `Cache-Control: no-cache` bypasses it. Middleware skips session lookup for this public endpoint; Home/feed and catalog caches are unchanged.

Migrations `0026_discover_pulse_activity_indexes.sql` and `0027_discover_pulse_activity_window_index.sql` must be applied to the target D1 database before deploying the endpoint. Migration 0026 adds `(ranking_id, created_at)` indexes for comments and votes and replaces the redundant ranking-only comments index. Migration 0027 adds the expression index used to find rankings by `COALESCE(last_activity_at, created_at)`. The index is also present in `schema.sql` and in the broader Home feed migration 0024; this small idempotent migration allows Pulse to deploy independently while 0024 remains staged. Both migrations were rehearsed locally.

Retained votes have one row per user and preserve their original `created_at` when changed. A changed or removed vote is therefore not a full historical reaction event. Also, `last_activity_at` holds only the latest timestamp, so a ranking revived after LAST WEEK may no longer be selected by that historical activity scan. The page reports only events and timestamps that the current schema can verify, and does not claim an exhaustive historical trend series.

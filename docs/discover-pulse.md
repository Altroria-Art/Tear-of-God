# Discover Pulse

Discover now opens on recent community activity. Search and Saved Templates keep their focused results view; the full template and hashtag catalogs remain linked under Explore Everything. Pulse topics are derived from hashtags on actual rankings, with a template or ranking title used only when a ranking has no tags. Topic links open the existing hashtag, template, or post route.

## Data and windows

`GET /api/discover-pulse?window=now|today|week|last_week` is public and read-only. Its windows are rolling UTC intervals: 6 hours, 24 hours, 7 days, and the preceding completed 7-day interval `[now−14d, now−7d)`. The response includes both the requested and effective window. NOW falls back to TODAY when it has no eligible rankings; TODAY falls back to THIS WEEK on the same condition. No activity is invented to fill a section. Empty sections are omitted.

Two indexed queries take at most 40 newly created and 40 recently active rankings. After deduplication, comment and retained-vote counts are queried only for those candidate IDs and only inside the selected interval. Up to 80 template/profile rows are hydrated. The four leading templates get up to four real item names each through indexed preview queries. The response contains at most 5 topic cards, 4 active rankings, 4 discussions, 12 hashtags and 4 active templates. Topic and template counts are measured within this bounded sample; `sampled: true` triggers an explicit note in the UI when either candidate limit is reached. No catalog or feed endpoint is called to assemble the default Pulse page.

Activity signals count new rankings, comments and retained votes created in the selected window. A ranking's persisted `last_activity_at` contributes one signal only when no creation, current comment or retained vote is available in the window. Ranking and reaction counts are never taken from all-time mirror counters. The section is called **Active in this window**, since the endpoint does not compare against a prior period and cannot justify a “Rising” label or a growth percentage.

Ordering gives the newest qualifying activity up to 40 points. Recent comments add at most 10, new rankings at most 6, retained reactions at most 4, and distinct active rankings at most 5. This caps engagement so old totals cannot dominate a current window. Discussion cards are ordered by recent comment count, then latest activity.

## Cache and rollout

The endpoint uses the existing public response cache with one canonical key per window, without cookies or viewer fields. TTL is 120 seconds for NOW, 300 for TODAY, 600 for THIS WEEK and 1800 for LAST WEEK. Explicit `Cache-Control: no-cache` bypasses it. Middleware skips session lookup for this public endpoint; Home/feed and catalog caches are unchanged.

Migration `0026_discover_pulse_activity_indexes.sql` must be applied to the target D1 database before deploying the endpoint. It adds `(ranking_id, created_at)` indexes for comments and votes, and replaces the redundant ranking-only comments index. This allows period counts to seek directly to the time range even when a ranking has a long interaction history. The migration was rehearsed locally; no remote migration or deployment was performed in this branch.

Retained votes have one row per user and preserve their original `created_at` when changed. A changed or removed vote is therefore not a full historical reaction event. Also, `last_activity_at` holds only the latest timestamp, so a ranking revived after LAST WEEK may no longer be selected by that historical activity scan. The page reports only events and timestamps that the current schema can verify, and does not claim an exhaustive historical trend series.

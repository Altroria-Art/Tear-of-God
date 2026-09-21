# Cold feed reads: placement range index and For You eligibility

Local Miniflare D1 measurements, not production telemetry. Run
`node tests/local/cold-feed-reads.mjs`. Fixture: 2,000 rankings, 40,000 placements,
10 templates, 20% of placements assigned tiers, custom/NULL tiers, duplicate
positions, duplicate/empty/escaped hashtags, and different viewer interests.

| Operation | Before rows read | After rows read |
|---|---:|---:|
| Cold community aggregates for two templates | 10,192 | 4,160 |
| For You eligibility selection alone (same old index) | 18,218 | 1,018 |
| Complete cold For You page 1 | 49,322 | 14,042 |
| Complete cold For You page 2 | 59,507 | 18,195 |
| Complete cold Following page 1 | 32,294 | 14,214 |
| Complete cold Trending page 1 | 40,197 | 19,093 |

The new `(ranking_id,tier,item_id)` index puts the non-NULL tier range immediately
after the ranking lookup. It replaces the single-column index. Unlike the
previously rejected `(ranking_id,item_id,tier)` candidate, it skips unranked items
instead of walking them. Histogram outputs remain identical. Savings depend on
unranked items: on the density check, 0% ranked reads 8,276 -> 757; 50% ranked
12,035 -> 8,275; 100% ranked remains 15,795. Fully ranked templates still need
the complete placement scan and grouping.

Placement insert/delete writes remain 3/1 in the local probe. A direct tier update
changes from 1 to 2 writes because tier is now indexed; current application paths
insert or delete placements, with no direct tier update. Index entries are wider,
and building the replacement has a one-time read/write/storage cost.
Explicit rowid tie-breakers preserve the previous per-ranking insertion order
for equal positions in feeds, detail/mine views and participant lists.

For You previously computed two CASE scores even though only eligibility mattered,
and used two correlated lookups through the DISTINCT hashtag view. It now accepts
any matching template immediately; otherwise it tokenizes that candidate's tags
once, using the exact view normalization and querying followed tag keys as a set.
No rank weights, ordering, 600-entry pool cap, 50-interest-tag cap, filters,
fallbacks, authentication, cache TTL or event writes change. This change needs no
schema migration and adds no writes.

Regression comparison uses the original eligibility SQL/bind ordering with the
same handler and compares complete feed responses. Coverage includes two pages
of each feed, anonymous/new/topic-only viewers, custom and NULL tiers, tied
positions, hashtag/author/template/date filters, exclude/pin, migration repetition,
and cascaded deletes. Existing feed/cache, publication atomicity and profile
checks pass; lint/build pass with the four existing fast-refresh warnings.

## Prepared only

`migrations-active/0013_placement_tier_index.sql` is independent of 0012. It was
tested only on an ephemeral Miniflare database. No remote migration or deployment
was performed, and 0012 was not edited or applied. For future activation, deploy
the explicit ordering changes before applying only 0013 to an existing database;
the personalized query works with the old index. Do not blindly apply the whole
migration directory: it includes previously pending migrations. Index savings
require 0013, while personalization savings require only the application change.

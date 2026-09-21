# D1 index efficiency (0012, not deployed)

Measured with `node tests/local/d1-index-efficiency.mjs` using local Miniflare D1
`meta.rows_read` / `meta.rows_written`. These are synthetic fixture measurements,
not production telemetry. Fixture: 500 templates, 5,000 rankings, 1,000 events.

| Operation | Before | After |
|---|---:|---:|
| Recent templates, first 12: rows read | 7,523 | 679 |
| Recent templates, second page: rows read | 7,523 | 704 |
| Anonymous analytics insert: rows written | 6 | 5 |
| Authenticated analytics insert: rows written | 6 | 6 |
| Ranking insert: rows written | 7 | 6 |
| Frozen score insert, per item: rows written | 5 | 5 |
| Template item insert: rows written | 4 | 3 |
| Vote insert: rows written | 5 | 4 |
| Template reaction insert: rows written | 4 | 3 |
| Template use counter update: rows written | 3 | 1 |
| Template view counter update: rows written | 2 | 1 |

The creation-order index bounds recent-list work. Redundant single-column indexes
are removed where existing composite or UNIQUE indexes cover their leading key.
Unused mirror-counter ordering indexes are removed; the counters themselves and
their consumers remain unchanged. A partial analytics user index excludes NULL
users; all event rows, event IDs, retries, funnels and retention remain unchanged.

The benchmark compares complete list and analytics responses before/after, checks
indexed lookup plans, migration repeatability and analytics foreign-key SET NULL.
Popular/views lists remain 7,523 reads; the seven-day analytics report remains
3,605 reads. Feed placement aggregates on cache misses and personalized candidate
selection remain major read consumers. Exact unread counts still read matching
unread rows. Eliminating these scans needs separate correctness/invalidation work.

Trade-off: one-time index creation/rebuild reads and writes, plus storage for the
new creation-order index. No sampling, delayed counters or new cache staleness.
Cloudflare documents that indexes contribute to [D1 rows written](https://developers.cloudflare.com/d1/platform/pricing/).

## Migration prerequisites

`migrations-active/0012_d1_index_efficiency.sql` is prepared only. Existing databases
need this migration for savings; changing `schema.sql` alone does not update them.
Before applying, verify 0011 is recorded and that
UNIQUE indexes exist on
`votes(ranking_id,user_id)` and `template_reactions(template_id,user_id)`.
Production inspection found the legacy score table lacks the UNIQUE index.
The readiness revision retains idx_ris_ranking, so score writes no longer decrease
and 0002 is not required. See [production readiness](deploy-quota-0012-0015.md).
Use `PRAGMA index_list` / `PRAGMA index_info` to verify deployed index definitions.
Do not apply historical migrations blindly. 0012 does not require the pending
0010 category drop and must not inadvertently apply it. The existing
`wrangler.quota.toml` selects only 0011, not 0012. No deployment or remote migration
was performed for this change.

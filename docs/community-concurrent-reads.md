# Concurrent community aggregate reads

`functions/lib/community-cache.js` shares pending public template aggregates
between overlapping cold feed requests. It keeps the existing SQL, cache TTL,
viewer-specific queries and fresh pinned bypass. Entries are removed when reads
settle, including failures, and tracking is capped at 256 templates per isolate.
Requests beyond that cap query normally.

Local Miniflare D1 measurement (`node tests/local/community-concurrent-reads.mjs`):
200 rankings, 4,000 placements, two templates, including NULL and custom tiers.
Ten overlapping cold requests: 20 -> 2 aggregate queries; 74,050 -> 7,405 rows
read; 0 -> 0 rows written. Baseline is ten independent executions of the unchanged
queries. A single request remains 7,405 reads. This is not production telemetry.

Tests verify identical histograms/counts, partial overlap, origin isolation,
fresh bypass, visibility of subsequent contributions, and recovery after D1
failure. Existing quota-hot-path feed checks, lint and build pass.

Trade-offs: only concurrent requests within one isolate share work; no new
staleness window. Concurrent callers share query latency/failure. Worker request
counts are unchanged. No migration required; 0012 was neither edited nor applied.
No deployment performed.

Rejected candidates: replacing the placement prefix index with a covering index
did not reduce measured rows read and increased tier-update writes from 1 to 2.
Replacing the template join with an IN subquery increased a sample histogram
from 7,401 to 7,602 reads. Neither change is retained.

Remaining: first-miss placement scans, personalized candidate scoring, and exact
unread counts. Authenticated analytics retains event inserts: suppressing distinct
events would change funnel/session reports; event-ID retries already use INSERT
OR IGNORE. Incremental aggregates would require transactional maintenance across
publication and all delete paths plus reconciliation, so they are not introduced
without a separately measured read/write trade-off.

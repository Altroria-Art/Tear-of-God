# Remaining D1 work — prepared, not activated

Local Miniflare measurements (`node tests/local/remaining-d1.mjs`), not production
telemetry. Tests use disposable databases; no saved local or remote database was
migrated. No deployment was performed.

| Change | Before | After | Cost |
|---|---:|---:|---|
| Exact unread lookup, 500 unread notifications | 501 reads | 1 read | Counter maintenance on mutations |
| Complete notification GET, same list/payload | 562 reads | 62 reads | Same HTTP request count |
| Insert unread notification for existing recipient | 4 writes | 5 writes | +1 counter write |
| Authenticated analytics insert | 6 writes | 5 writes | Wider secondary-index keys |
| Duplicate analytics event ID | 0 writes | 0 writes | Unchanged idempotency |

## Exact unread counts

0015 backfills a derived per-user count and installs transactional triggers.
Inserts, read/unread transitions, recipient changes, digest upserts, direct deletes
and foreign-key cascades maintain exact counts. Ignored duplicate inserts and
no-op read updates do not increment/decrement them. Counter changes roll back
with their notification transaction. No TTL, eventual consistency or approximation.

The route uses the new table only when `NOTIFICATION_UNREAD_COUNTS=true`; the
default still runs the old COUNT and works without 0015. Even fresh databases
created from schema.sql need 0015 before enabling this optional feature: the
counter table/triggers deliberately live together in that migration. Test/read
the counter before enabling; setting the flag alone cannot create it.

Trade-off: +1 write per unread insert/delete or read-state transition; moving an
unread notification between users changes two counters. Storage grows by at most
one row per recipient. Enable only when repeated exact-count reads justify these
writes. Current writers use INSERT, INSERT OR IGNORE, or UPSERT, not REPLACE.
Do not introduce INSERT OR REPLACE on notifications: SQLite replacement-delete
trigger behavior depends on recursive_triggers. Plain updates/upserts are covered.

## Analytics storage

0014 rebuilds analytics_events as WITHOUT ROWID, eliminating its redundant rowid
storage/primary-key index pair while retaining all four report/FK indexes.
Every event, timestamp, identity, session, entity, retention rule and report stays
intact. No event sampling or omission. Authenticated inserts save one write;
anonymous inserts also save one beyond 0012. Reports compare exactly, including
after parent-user deletion sets event user_id to NULL.

Trade-off: secondary indexes now carry the text event ID rather than an integer
rowid. There is a one-time rebuild: the mixed 1,000-event fixture used **4,705
rows written**. Estimate production rebuild reads/writes and storage headroom
before scheduling; the existing Free Tier write allowance may be insufficient
for a large history. Do not execute this blindly against a large event table.

## Migration review

- **0012:** added fail-closed checks for the vote/reaction two-column UNIQUE indexes
  before dropping their redundant prefixes. Replacement index columns,
  collations, uniqueness and partial-index shape are checked before removals.
  A conflicting replacement index definition causes rollback. Production readiness
  inspection found unreconciled scores; the revised migration retains idx_ris_ranking
  and does not require 0002. See [the final readiness runbook](deploy-quota-0012-0015.md).
  Still independent of the pending 0010 category drop.
- **0013:** verifies a rowid placement table and rejects a conflicting replacement
  index. Deploy explicit placement-order tie-breakers before applying it. The
  wider index adds a write to direct tier updates; current writers insert/delete.
  Fully ranked aggregation receives no additional read benefit.
- **0014:** requires 0012. Rejects NULL event IDs, extra columns, custom indexes,
  dependent views/triggers and incoming foreign keys before rebuilding the child
  table. Copies all seven columns, checks row counts, preserves the profiles FK.
  Cloudflare-internal tables are excluded from metadata inspection using literal
  prefixes, avoiding D1 authorization failures.
- **0015:** requires the current notifications schema and normal FK enforcement.
  Counter backfill and all four triggers must commit in one transaction.
  Existing counter/trigger objects fail instead of being silently reused.

Use transactionally applied, explicitly selected migrations only. The existing
wrangler.quota.toml selects only 0011; do not use a blanket migration apply, which
could also run pending 0010. Production preflight is recorded in the readiness runbook.
0012/0013 success and repetition, rejected legacy/drifted schemas, rollback,
analytics report equivalence, event retries, counter digests/transfers/read-all,
and notification/ranking/profile cascades were checked locally.

Rollback: disable the counter flag to restore the original read path; leaving
the counter triggers enabled still incurs maintenance writes until explicitly
removed. Analytics application rollback works with either storage layout.

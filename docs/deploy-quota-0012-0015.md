# 0012–0015 readiness — 2026-09-21

Ready with the corrected 0012 and the ordered rollout below. Nothing deployed or
applied to an existing database. Production checks were read-only; rehearsal used
production DDL and synthetic values matching aggregate row counts, never user data.

## Verified production state

- Database `tear-of-god-db`, ID `69d366f1-55ba-43cf-a492-882e137786f4`, size 4,161,536 bytes.
- Migration ledger contains 0009 and 0011; do not infer that 0002 ran.
- 208 analytics events (156 authenticated), 5,302 placements, 74 templates;
  22 notifications, 20 unread across 9 recipients. No NULL event IDs, orphan
  analytics users, orphan unread recipients or duplicate score pairs were found.
- **Correction:** production lacks UNIQUE(ranking_id,item_id). 0012 now retains
  idx_ris_ranking rather than requiring 0002 or dropping the only ranking lookup.
  Previously reported score-insert savings do not apply; its writes stay unchanged.
- Production branch is master. Current rollback deployment:
  `175c08c7-4e4c-4140-8b29-8915aa66e45f` (source 272e90d).
  Local HEAD is f69db14 plus the pending changes: review/freeze that complete
  working tree before upload. The old notification writers use INSERT/UPSERT,
  not REPLACE, and remain compatible with the triggers.
- Production unread-count flag is absent (disabled). The repository now explicitly
  sets it to false for the first deployment. Production uses the intended D1 ID.
- Time Travel info succeeded. Obtain a fresh bookmark immediately before rollout;
  the readiness bookmark is not the deployment rollback boundary.

## Cost and headroom

Rehearsal against the actual production DDL with production row counts:

| Migration | Rows read | Rows written |
|---|---:|---:|
| 0012 | 1,582 | 236 |
| 0013 | 11,009 | 5,306 |
| 0014 | 3,440 | 1,027 |
| 0015 | 23 | 15 |
| Total | 16,054 | 6,584 |

These are estimates for production, not remotely measured migration executions;
allow for migration-ledger writes, data growth and live traffic. Reserve at least
100,000 reads and 20,000 writes when starting this small rollout. Rehearsal does
not substitute for an up-to-date quota check.

Production reported 4,290,668 reads / 13,448 writes over the prior 24 hours. The
only other account D1 database, my_db, reported zero usage. Rolling 24-hour usage
is a conservative bound for the current UTC day, subject to reporting delay.
The snapshot plus migration estimate fits the 5M-read/100K-write daily Free
allowance, but traffic is close enough to the read limit to recheck immediately.
[Cloudflare pricing](https://developers.cloudflare.com/d1/platform/pricing/).

At current scale the unread-count saving is small (20 unread total), unlike the
500-unread benchmark. 0015 adds a counter write on unread mutations even while
its read flag is disabled. It is optional if minimizing writes is preferable.
The steps below intentionally include all four requested migrations.

## Exact PowerShell rollout (not executed)

Run one step at a time from `D:\GitHub\Tear-of-God`. Stop on any nonzero exit code;
never continue past a failed verification. Do not run npm run deploy early or
apply the default migrations directory.

1. Freeze/review the working tree; keep production flag false. Recheck usage and
   the rollback target. If aggregate 24-hour reads exceed 4,900,000 or writes
   exceed 80,000, wait for headroom and reassess. If database counts grew materially,
   repeat the rehearsal before proceeding.

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/quota-rollout.log'
$wrangler = '.\node_modules\.bin\wrangler.cmd'
git status --short
& $wrangler d1 info tear-of-god-db --config wrangler.quota-0012-0015.toml --json
& $wrangler d1 info my_db --json
& $wrangler pages deployment list --project-name tear-of-god --environment production --json
& $wrangler d1 migrations list tear-of-god-db --remote --config wrangler.quota-0012-0015.toml
```

The pending list must contain exactly 0012, 0013, 0014, 0015 in that order (or
only their still-unapplied suffix after a partial successful rollout). 0010 must
not appear. The dedicated config's pattern was verified against production.

2. Build and validate. Deploy the compatible application first, with
   `[env.production.vars] NOTIFICATION_UNREAD_COUNTS = "false"`. This establishes
   explicit item-order tie-breakers before 0013 changes the placement index.

```powershell
npm run lint
npm run build
& $wrangler pages functions build --outdir .wrangler/readiness-functions --compatibility-date 2026-01-01
node tests/local/remaining-d1.mjs
node tests/local/d1-index-efficiency.mjs
node tests/local/cold-feed-reads.mjs
& $wrangler pages deploy dist --branch master --project-name tear-of-god --commit-dirty=true
```

Check public feeds and template/detail ordering, then your authenticated
notification menu and admin analytics. Verify the disabled flag and intended D1
binding in deployment settings. Record this new deployment ID as the preferred
rollback target for the later flag activation.

3. Capture a new bookmark, then apply only the four selected migrations. Wrangler
   applies each migration transactionally; a failure rolls back that migration,
   while earlier successful migrations remain recorded. Stop if any fail.
[Cloudflare migration semantics](https://developers.cloudflare.com/workers/wrangler/commands/d1/).

```powershell
& $wrangler d1 time-travel info tear-of-god-db --config wrangler.quota-0012-0015.toml --json > .wrangler/quota-rollout-bookmark.json
if ($LASTEXITCODE -ne 0) { throw 'Bookmark capture failed' }
& $wrangler d1 migrations apply tear-of-god-db --remote --config wrangler.quota-0012-0015.toml
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; leave feature disabled' }
```

4. Verify before activation. Expect layout=1, triggers=4, retained score index=1,
   both mismatch/orphan counts=0, and all four ledger entries. The unread check is
   a single consistent SQL statement, so ordinary live writes do not create a
   false comparison between two snapshots.

```powershell
& $wrangler d1 execute tear-of-god-db --remote --config wrangler.quota-0012-0015.toml --file scripts/sql/verify-quota-0012-0015.sql --json
if ($LASTEXITCODE -ne 0) { throw 'Verification query failed' }
& $wrangler d1 migrations list tear-of-god-db --remote --config wrangler.quota-0012-0015.toml
```

5. Only after all verification values pass, change the one production line in
   wrangler.toml to `NOTIFICATION_UNREAD_COUNTS = "true"`, then deploy again.
   Do not rely on a dashboard-only variable override: this project is managed by
   wrangler.toml and the next deployment can replace that override.

```powershell
git diff -- wrangler.toml
& $wrangler pages deploy dist --branch master --project-name tear-of-god --commit-dirty=true
```

Check your unread count, mark one existing notification read, refresh, and rerun
the verification SQL. Check analytics reports without generating synthetic
production events. If only the counter feature is unwanted, leave its flag false;
the other three optimizations do not depend on it.

## Rollback safety

- **Counter read issue:** set the production flag false and redeploy, or roll back
  to the disabled-flag deployment from step 2. This restores the exact COUNT path.
- **Counter trigger/write issue:** disabling the flag alone does not stop triggers.
  After serving code uses false, remove only the derived counter and triggers:

```powershell
& $wrangler d1 execute tear-of-god-db --remote --config wrangler.quota-0012-0015.toml --file scripts/sql/rollback-unread-counters.sql
```

  Notifications/events remain intact. The ledger stays; re-enabling later needs
  a new backfill migration, not merely changing the flag back to true.
- **Full application rollback:** leave analytics WITHOUT ROWID and the safe 0012
  indexes in place; previous APIs support them. Before restoring a pre-tie-breaker
  application, restore the old placement index (about 5,302 index writes now):

```powershell
& $wrangler d1 execute tear-of-god-db --remote --config wrangler.quota-0012-0015.toml --command "CREATE INDEX IF NOT EXISTS idx_ranking_items_ranking_id ON ranking_items(ranking_id); DROP INDEX IF EXISTS idx_ranking_items_ranking_tier;"
```

  Then use Pages → tear-of-god → Deployments → the recorded pre-rollout deployment
  → Rollback. Verified API equivalent:
  `POST /accounts/907d0f6d7a9d86e275a836997104c225/pages/projects/tear-of-god/deployments/175c08c7-4e4c-4140-8b29-8915aa66e45f/rollback`.
  Recheck the target at rollout time; it may have changed since this review.
- **Database disaster only:** stop application writes first and explicitly accept
  loss of all changes since the bookmark. A whole-database Time Travel restore
  also rewinds unrelated user activity and migration bookkeeping; it is not the
  normal rollback. Disable the counter feature in serving code before restoring.

```powershell
$restorePoint = Get-Content .wrangler/quota-rollout-bookmark.json -Raw | ConvertFrom-Json
& $wrangler d1 time-travel restore tear-of-god-db --config wrangler.quota-0012-0015.toml --bookmark $restorePoint.bookmark
```

Free-plan Time Travel lasts seven days. Reconcile the ledger/schema and serving
code after a restore before reopening writes.
[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/),
[limits](https://developers.cloudflare.com/d1/platform/limits/).

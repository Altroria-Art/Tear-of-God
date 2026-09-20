# Hashtags-only rollout

The application no longer reads or writes `rankings.category` or
`templates.category`. Hashtags remain CSV in the existing `hashtags` columns.
The `ranking_hashtags` and `template_hashtags` views expose distinct normalized
tags for filtering, personalization, profile taste and admin aggregates.
They are views, not another copy of the data.

## Data and behavior changes

- Preserve a nonempty legacy category by adding it to hashtags if absent.
- Convert category topic follows to hashtag follows and merge duplicates.
- For You matches hashtag interests or template history. Similar-user scores
  use hashtags (70%) and shared templates (30%). No primary category is inferred.
- Hashtag distributions count each tag once per ranking. A ranking can contribute
  to several tags. Profile percentages use the total number of tag assignments.
- Legacy `/category/:id` links redirect to `/discover/hashtag/:id`.
  The API's old `category` query parameter is a compatibility alias for `hashtag`.
  `/api/categories` serves the hashtag catalog; new callers use `/api/hashtags`.
- Historical migrations and historical schema fixtures keep category references
  because they describe the old schema. Do not edit already-applied migrations.

## Deployment sequence

No existing local database or remote database was changed while preparing this
patch. Tests create isolated Miniflare databases from synthetic fixtures.

For an existing database, `schema.sql` is not an upgrade script. Do not reset or
restore an existing database to perform this change. Follow the production
runbook's backup, schema/ledger audit, dedicated configuration and approval
requirements before any production write.

1. Verify migrations through `0008_profile_taste_identity.sql` are reflected in
   the target schema. Inspect the actual migration ledger and indexes. Back up
   the database before changing it. Unexpected views/triggers/indexes referencing
   category must be reviewed before dropping the columns.
2. Enable `MAINTENANCE_READ_ONLY=1` before backfill and keep it enabled until
   all rollout checks finish, so old clients cannot add new category-only data.
3. Apply **only** `0009_hashtag_transition.sql` through Wrangler migration
   discovery/ledger, using a dedicated migration configuration whose discovery
   includes the approved prefix through 0009, not 0010. This backfills hashtags,
   converts category follows and creates both views while keeping category
   columns for compatibility with the old app.
4. Deploy the new frontend and Pages Functions. Check the feed, template lookup,
   hashtag filters, profile, admin dashboard and session restore in read-only
   mode. The new code works with the expanded schema before column removal.
5. After review of the concrete rollout result and approval for the destructive
   schema step, apply `0010_drop_category.sql` through the migration ledger. It
   removes category indexes and columns and narrows topic types to hashtag and
   template. Do not apply all pending migrations before deploying the new code.
6. Verify `PRAGMA table_info(rankings)`, `PRAGMA table_info(templates)`,
   `PRAGMA foreign_key_check`, row counts, saved hashtags, normalized topic follows
   and the views. Disable read-only mode and smoke-test publishing and follows.

Do not use the default legacy `migrations/` directory or the synthetic
`wrangler.phase3d*.toml` files for this rollout. Do not silently switch the
repository-wide migration discovery configuration.

Before 0010, an app rollback retains the old category columns, but the old UI
will show stale category-based summaries for new hashtag-only content. After
0010, rolling back only the app is unsafe: use a coordinated database and app
recovery from the approved backup/Time Travel point, accounting for new writes.

## Local verification

`node tests/local/hashtags-only.mjs` rehearses both migrations, injects a failure
to verify rollback, checks fresh-schema parity and retained rows/follows, and
exercises filtering, personalized feeds, profiles, dashboard, notifications and
publishing without a category column. It does not contact production.

Related regressions: `ranking-atomicity.mjs`, `profile-similar-lazy.mjs`,
`trending-pool-cache.mjs`, `spotlights-optimization.mjs`,
`admin-dashboard-queries.mjs` and `cache-observability.mjs` under `tests/local/`.

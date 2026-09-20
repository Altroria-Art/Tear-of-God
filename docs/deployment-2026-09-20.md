# Deployment checkpoint — 2026-09-20

Follow-up deployment: https://bb393082.tear-of-god.pages.dev adds direct admin
comment deletion without a report, for both ranking and template comments.
Local tests verified admin access, rejected forged/revoked roles, preserved replies
and counters; lint/build passed. No additional database migration was applied.

User requested production deployment before pausing work.

- Production: https://tear-of-god.pages.dev
- Deployment: https://4b0d261a.tear-of-god.pages.dev
- Pages project: `tear-of-god`, production branch: `master`.
- Deployed the working tree on `codex/thai-time-display`; changes remain uncommitted.
- Frontend build and Pages Functions compilation passed.
- Live checks: current frontend bundle, spotlights, template suggestions, hashtag
  suggestions and trending feed returned 200; unauthenticated admin returned 401.
- Authenticated admin flows and production mutations were not smoke-tested.

## Database checkpoint

Production D1 binding/UUID matched repository configuration. The actual migration
ledger was empty, although feature tables including `profile_pins` already existed.
The older schema reconciliation described in the historical runbook has NOT been
applied. Do not apply all active migrations blindly.

Applied ONLY `0009_hashtag_transition.sql` through Wrangler migration discovery
with a dedicated config and exact migration pattern. This additive deployment
kept category columns; no maintenance flag was enabled. A full SQL backup was
downloaded before migration and is stored in the ignored directory
`.wrangler/hashtag-rollout-20260920/`, alongside audited configuration files.
Do not commit the backup: it contains private production data.

After migration: rankings = 636, templates = 68, topic follows = 0, foreign-key
violations = 0. Ranking/template counts match the pre-migration snapshot.

## Resume here

`0010_drop_category.sql` remains UNAPPLIED. The deployed application uses hashtags,
but the physical category columns remain for rollback compatibility. Before
removing them, inspect fresh schema/ledger and any writes from older deployment
URLs or clients, reconcile any new category-only data, and follow the staged
rollout checks in `hashtags-only-migration.md`. No further work is scheduled.

# Retained reports and moderation history — 9 October 2026

## Behavior

Reports remain in the admin archive after either decision. Keep content closes a report as `resolved` with action `kept`. Delete content atomically deletes the target and closes its reports with action `deleted`. New reports appear only in Pending review; both reviewed decisions appear in Resolved. The UI has only these two tabs. The API retains the `all` filter for compatibility. Closed reports have no expiry. A surviving target can be reopened at any age, with earlier decisions retained in the history. A deleted target cannot be reopened.

Each new report captures its original title/description or comment text, hashtags and comment context when inserted. Later edits do not change that snapshot. Saved text is rendered as text, including HTML-like strings. Admins can open View record for the saved text, reason and action history. The report list and evidence require verified admin access.

Deleting a target elsewhere, deleting its parent, recursively deleting replies, or deleting a user retains the report and marks affected targets `removed`. This action distinguishes external/cascading removal from the explicit report moderation decision. Known report decisions include the admin ID/name and UTC time. History retains the recorded admin name if the account is later deleted. Reporter references become null when that account is deleted; report text and history remain.

Moderation actions describe decisions about content. Future profanity labels require separate review; deleting content alone does not establish that its text is profanity. This change stores evidence for future work, without starting a training job.

## Database and endpoints

- Migration `migrations/0019_report_retention.sql` replaces the report target cascade FKs with `ON DELETE SET NULL`, adds snapshot/decision/removal fields, and adds `report_actions`.
- SQLite triggers capture new report text and action changes, and preserve reports on all four content-table deletion paths. The history FK prevents report deletion through the old purge path.
- Surviving historical rows retain their IDs and timestamps. Their current text is backfilled; older closed decisions are marked `legacy`, since their original action cannot be reconstructed reliably. Already deleted/expired reports and earlier versions of edited text cannot be recovered by this migration.
- Admin report POST `delete_content` takes a report ID. Decision updates, content deletion, nested cascades and counter reconciliation run in one D1 batch. Failed batches leave content and decisions unchanged. Repeated/concurrent deletion does not duplicate decisions or counters.
- The old report POST `delete` action is rejected. Explicit report cleanup was removed from template, ranking and account deletion. Original content removal/counter/cache behavior remains in shared deletion plans.
- The fresh `schema.sql` includes the same tables/triggers. Local test fixtures use a shared SQLite script splitter so trigger bodies and quoted semicolons remain intact.

## Validation and local application

- Build passed; lint passed with the four existing Fast Refresh warnings.
- 46 affected local fixture/security suites passed after updating the orphan-cleanup assertion to require retained evidence. The first fixture run recorded 45/46; the corrected orphan suite subsequently passed. No SQL budgets were increased; verified-session Comments still uses 7 statements against its existing budget of 8.
- The retention regression covers keep/reopen without expiry, original text after edits, all four direct deletion kinds, recursive/parent/account cascades, repeat/concurrent decisions, counters, authorization, rejected report deletion, transaction rollback, migration/backfill and FK checks.
- Chromium fixture QA passed 19 admin scenarios across English/Thai and desktop/mobile: custom confirmations, cancellation, Escape/backdrop, pending locks, duplicate clicks, failure/retry, successful deletion, retained Resolved records and safe original-text/history display.
- Read-only authenticated browser/API QA on `127.0.0.1:8788` passed with the user-provided admin account. Both existing Local reports and their histories remained readable. QA sessions were logged out.
- Local D1 was exported first to ignored `.wrangler/report-retention/local-before-0019.sql`, then migration 0019 was applied. Counts remained 2 reports, with 2 initial history entries; `PRAGMA foreign_key_check` returned no violations.
- QA evidence is ignored under `.wrangler/report-retention/` and `.wrangler/admin-confirmation-qa/`. No Production/Preview DB migration, deployment or Git commit was performed in this change.

## Cloudflare rollout

Migration 0019 is required before the new Functions can use the archive fields. Test migration and the matching build against the separate Preview D1 first. Before Production, export D1 and record report counts/FK checks, quiesce moderation/content mutations, apply 0019 once, deploy the matching Functions/build, then verify counts, FK integrity, admin access, Pending/Resolved and saved records before resuming mutations. The older Functions must not continue serving report purge/deletion requests during this transition. A code-only rollback to the old expiry implementation is unsuitable after this migration; retain the archive-compatible endpoint or coordinate a tested database restore.

Live destructive QA, remote migration/deployment, Safari/Firefox, and a future dataset export/classifier were not performed. The browser mutation checks use isolated fixtures; the actual Local check reads existing records.

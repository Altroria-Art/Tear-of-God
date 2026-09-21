-- Only after the serving application has NOTIFICATION_UNREAD_COUNTS=false.
-- Derived data only: no notification or event is removed.
DROP TRIGGER IF EXISTS notification_unread_insert;
DROP TRIGGER IF EXISTS notification_unread_delete;
DROP TRIGGER IF EXISTS notification_unread_update_old;
DROP TRIGGER IF EXISTS notification_unread_update_new;
DROP TABLE IF EXISTS notification_unread_counts;
-- Keep the migration ledger: a future re-enable requires a new backfill migration.

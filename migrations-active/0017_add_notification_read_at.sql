-- 24-hour retention for READ notifications. The expiry countdown starts at
-- read time (read_at), never at creation time; unread notifications never
-- expire. Read rows are purged lazily by GET /api/notifications (per-user),
-- and the GET read partition also hides them after 24h even before the purge.
-- read_at is set exactly once when a notification first flips to read, so
-- re-opening an already-read row must not extend the window.
--
-- 1. Existing unread rows keep read_at NULL (never expire) — nothing to do.
-- 2. Existing read rows get a fresh 24h window from migration time instead of
--    being deleted instantly based on age inferred from created_at.
-- 3. Index serves both the per-user lazy purge and the read partition filter
--    on (user_id, is_read, read_at) — verified with EXPLAIN QUERY PLAN.
ALTER TABLE notifications ADD COLUMN read_at DATETIME;

UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE is_read = 1;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON notifications(user_id, is_read, read_at);
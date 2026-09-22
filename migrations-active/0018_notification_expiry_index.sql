-- Global expiry index for the dedicated cleanup Worker
-- (workers/notification-cleanup). The cron job deletes read notifications
-- past their 24h retention across ALL users:
--
--   DELETE FROM notifications
--   WHERE is_read = 1
--     AND read_at IS NOT NULL
--     AND read_at <= datetime('now', '-24 hours');
--
-- Without this index that DELETE is a full SCAN notifications (EXPLAIN
-- QUERY PLAN confirmed ~216 units). The per-user index from 0017
-- (user_id, is_read, read_at) cannot help a global scan, so this partial
-- index covers exactly the candidate set (read rows with a non-NULL
-- read_at) and turns the delete into a read_at range lookup
-- (SEARCH ... USING COVERING INDEX idx_notifications_expired_read
--  read_at>? AND read_at<?). Unread rows are excluded by the partial
-- index predicate, so the unread counter triggers (WHEN OLD.is_read = 0)
-- never fire for this DELETE.
CREATE INDEX IF NOT EXISTS idx_notifications_expired_read
  ON notifications(read_at)
  WHERE is_read = 1 AND read_at IS NOT NULL;
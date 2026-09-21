-- Optional exact-count acceleration. Apply transactionally before enabling
-- NOTIFICATION_UNREAD_COUNTS=true. No application source path uses REPLACE.
-- Deliberately fail on an existing counter/trigger instead of silently accepting
-- an incompatible definition. Migration bookkeeping prevents repeated rebuilds.
CREATE TABLE notification_unread_counts (
  user_id TEXT PRIMARY KEY,
  unread_count INTEGER NOT NULL CHECK (unread_count >= 0),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) WITHOUT ROWID;

-- Backfill and trigger installation must commit together.
INSERT INTO notification_unread_counts (user_id, unread_count)
SELECT user_id, COUNT(*) FROM notifications WHERE is_read = 0 GROUP BY user_id;

CREATE TRIGGER notification_unread_insert
AFTER INSERT ON notifications WHEN NEW.is_read = 0
BEGIN
  INSERT INTO notification_unread_counts (user_id, unread_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET unread_count = unread_count + 1;
END;

CREATE TRIGGER notification_unread_delete
AFTER DELETE ON notifications WHEN OLD.is_read = 0
BEGIN
  UPDATE notification_unread_counts SET unread_count = unread_count - 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER notification_unread_update_old
AFTER UPDATE OF is_read, user_id ON notifications
WHEN OLD.is_read = 0 AND (OLD.is_read IS NOT NEW.is_read OR OLD.user_id IS NOT NEW.user_id)
BEGIN
  UPDATE notification_unread_counts SET unread_count = unread_count - 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER notification_unread_update_new
AFTER UPDATE OF is_read, user_id ON notifications
WHEN NEW.is_read = 0 AND (OLD.is_read IS NOT NEW.is_read OR OLD.user_id IS NOT NEW.user_id)
BEGIN
  INSERT INTO notification_unread_counts (user_id, unread_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET unread_count = unread_count + 1;
END;

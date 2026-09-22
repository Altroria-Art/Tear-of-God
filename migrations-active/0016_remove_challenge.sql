-- Remove the retired Challenge feature end-to-end from the notifications schema:
-- 1. purge legacy type='challenge' rows (creates no new ones; app no longer inserts them)
-- 2. drop 'challenge' from the type CHECK constraint
-- 3. drop source_ranking_id (was only used by Challenge notifications / compare metadata)
-- 4. drop idx_notifications_challenge_unique
-- 5. rebuild notification_unread_counts + its triggers exactly per 0015 so unread
--    counts stay accurate after the row purge (deleting challenge rows while read
--    would not have touched counters; rebuilding from the post-purge table keeps
--    every remaining notification's counter intact).
PRAGMA foreign_keys = OFF;

DELETE FROM notifications WHERE type = 'challenge';

DROP TRIGGER IF EXISTS notification_unread_insert;
DROP TRIGGER IF EXISTS notification_unread_delete;
DROP TRIGGER IF EXISTS notification_unread_update_old;
DROP TRIGGER IF EXISTS notification_unread_update_new;

CREATE TABLE notifications__v4 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('comment', 'follow', 'template_use', 'following_rank', 'trending', 'community_average', 'like_digest')),
  ranking_id TEXT,
  comment_id TEXT,
  template_id TEXT,
  aggregate_count INTEGER NOT NULL DEFAULT 1 CHECK(aggregate_count > 0),
  digest_key TEXT UNIQUE,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

INSERT INTO notifications__v4 (
  id, user_id, actor_id, type, ranking_id,
  comment_id, template_id, aggregate_count, digest_key, is_read, created_at
)
SELECT id, user_id, actor_id, type, ranking_id,
       comment_id, template_id, aggregate_count, digest_key, is_read, created_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications__v4 RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, is_read, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_follow_unique
  ON notifications(user_id, actor_id) WHERE type = 'follow';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_comment_unique
  ON notifications(user_id, comment_id) WHERE type = 'comment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_template_use_unique
  ON notifications(user_id, ranking_id) WHERE type = 'template_use';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_following_rank_unique
  ON notifications(user_id, ranking_id) WHERE type = 'following_rank';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_trending_unique
  ON notifications(ranking_id) WHERE type = 'trending';

-- Rebuild exact-count acceleration (mirrors 0015_exact_unread_counts.sql) on the
-- post-purge rows so every remaining user's unread count stays correct.
DROP TABLE IF EXISTS notification_unread_counts;

CREATE TABLE notification_unread_counts (
  user_id TEXT PRIMARY KEY,
  unread_count INTEGER NOT NULL CHECK (unread_count >= 0),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) WITHOUT ROWID;

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

PRAGMA foreign_keys = ON;
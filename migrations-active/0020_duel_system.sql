-- 0020_duel_system.sql
-- 1. Create duels table for 1-to-1 taste comparison between challenger and template owner,
--    as well as challenger vs community average.
-- 2. Extend notifications table type CHECK constraint to include 'duel'.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  challenger_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  challenger_ranking_id TEXT NOT NULL,
  owner_ranking_id TEXT,
  similarity_score INTEGER NOT NULL CHECK(similarity_score >= 0 AND similarity_score <= 100),
  community_similarity_score INTEGER CHECK(community_similarity_score IS NULL OR (community_similarity_score >= 0 AND community_similarity_score <= 100)),
  community_sample_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenger_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (challenger_ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_ranking_id) REFERENCES rankings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_owner ON duels(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_template ON duels(template_id, created_at DESC);

-- Extend notifications table to accept 'duel' type while preserving all existing records
CREATE TABLE notifications__v5 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('comment', 'follow', 'template_use', 'following_rank', 'trending', 'community_average', 'like_digest', 'duel')),
  ranking_id TEXT,
  comment_id TEXT,
  template_id TEXT,
  aggregate_count INTEGER NOT NULL DEFAULT 1 CHECK(aggregate_count > 0),
  digest_key TEXT UNIQUE,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

INSERT INTO notifications__v5 (
  id, user_id, actor_id, type, ranking_id,
  comment_id, template_id, aggregate_count, digest_key, is_read, read_at, created_at
)
SELECT id, user_id, actor_id, type, ranking_id,
       comment_id, template_id, aggregate_count, digest_key, is_read, read_at, created_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications__v5 RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, is_read, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON notifications(user_id, is_read, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expired_read
  ON notifications(read_at)
  WHERE is_read = 1 AND read_at IS NOT NULL;
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

-- Recreate exact-count acceleration triggers for notification_unread_counts (from 0015 & 0016)
CREATE TRIGGER IF NOT EXISTS notification_unread_insert
AFTER INSERT ON notifications WHEN NEW.is_read = 0
BEGIN
  INSERT INTO notification_unread_counts (user_id, unread_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET unread_count = unread_count + 1;
END;

CREATE TRIGGER IF NOT EXISTS notification_unread_delete
AFTER DELETE ON notifications WHEN OLD.is_read = 0
BEGIN
  UPDATE notification_unread_counts SET unread_count = unread_count - 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER IF NOT EXISTS notification_unread_update_old
AFTER UPDATE OF is_read, user_id ON notifications
WHEN OLD.is_read = 0 AND (OLD.is_read IS NOT NEW.is_read OR OLD.user_id IS NOT NEW.user_id)
BEGIN
  UPDATE notification_unread_counts SET unread_count = unread_count - 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER IF NOT EXISTS notification_unread_update_new
AFTER UPDATE OF is_read, user_id ON notifications
WHEN NEW.is_read = 0 AND (OLD.is_read IS NOT NEW.is_read OR OLD.user_id IS NOT NEW.user_id)
BEGIN
  INSERT INTO notification_unread_counts (user_id, unread_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET unread_count = unread_count + 1;
END;

PRAGMA foreign_keys = ON;

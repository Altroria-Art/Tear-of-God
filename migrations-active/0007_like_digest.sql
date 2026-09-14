-- Store one unread like digest per user per Bangkok calendar day.
PRAGMA foreign_keys = OFF;

CREATE TABLE notifications__v3 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('comment', 'follow', 'challenge', 'template_use', 'following_rank', 'trending', 'community_average', 'like_digest')),
  ranking_id TEXT,
  source_ranking_id TEXT,
  comment_id TEXT,
  template_id TEXT,
  aggregate_count INTEGER NOT NULL DEFAULT 1 CHECK(aggregate_count > 0),
  digest_key TEXT UNIQUE,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (source_ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

INSERT INTO notifications__v3 (
  id, user_id, actor_id, type, ranking_id, source_ranking_id,
  comment_id, template_id, aggregate_count, digest_key, is_read, created_at
)
SELECT id, user_id, actor_id, type, ranking_id, source_ranking_id,
       comment_id, template_id, 1, NULL, is_read, created_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications__v3 RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, is_read, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_follow_unique
  ON notifications(user_id, actor_id) WHERE type = 'follow';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_comment_unique
  ON notifications(user_id, comment_id) WHERE type = 'comment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_challenge_unique
  ON notifications(ranking_id) WHERE type = 'challenge';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_template_use_unique
  ON notifications(user_id, ranking_id) WHERE type = 'template_use';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_following_rank_unique
  ON notifications(user_id, ranking_id) WHERE type = 'following_rank';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_trending_unique
  ON notifications(ranking_id) WHERE type = 'trending';

PRAGMA foreign_keys = ON;

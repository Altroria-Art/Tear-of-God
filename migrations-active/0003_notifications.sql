-- In-app notifications for comments, new followers, and completed challenges.
-- Additive only: no existing rows or application objects are rewritten.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('comment', 'follow', 'challenge')),
  ranking_id TEXT,
  source_ranking_id TEXT,
  comment_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (source_ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, is_read, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_follow_unique
  ON notifications(user_id, actor_id) WHERE type = 'follow';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_comment_unique
  ON notifications(comment_id) WHERE type = 'comment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_challenge_unique
  ON notifications(ranking_id) WHERE type = 'challenge';

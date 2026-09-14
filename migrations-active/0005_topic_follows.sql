-- Follow hashtags, categories, and templates for personalized feeds.
CREATE TABLE IF NOT EXISTS topic_follows (
  user_id TEXT NOT NULL,
  topic_type TEXT NOT NULL CHECK(topic_type IN ('hashtag', 'category', 'template')),
  topic_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_type, topic_key),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_follows_user_created
  ON topic_follows(user_id, topic_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_follows_topic
  ON topic_follows(topic_type, topic_key, created_at DESC);

-- Apply only after 0009 and deployment of the hashtag-only application.
DROP INDEX IF EXISTS idx_rankings_category;
DROP INDEX IF EXISTS idx_rankings_cat_created;
DROP INDEX IF EXISTS idx_templates_category;
ALTER TABLE rankings DROP COLUMN category;
ALTER TABLE templates DROP COLUMN category;

-- Merge category follows into hashtag follows without duplicate subscriptions.
CREATE TABLE topic_follows_hashtags (
  user_id TEXT NOT NULL,
  topic_type TEXT NOT NULL CHECK(topic_type IN ('hashtag', 'template')),
  topic_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_type, topic_key),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
INSERT INTO topic_follows_hashtags (user_id, topic_type, topic_key, created_at)
SELECT user_id, CASE WHEN topic_type = 'category' THEN 'hashtag' ELSE topic_type END,
  CASE WHEN topic_type IN ('category', 'hashtag') THEN lower(trim(ltrim(trim(topic_key), '#'))) ELSE topic_key END,
  MIN(created_at)
FROM topic_follows
GROUP BY user_id,
  CASE WHEN topic_type = 'category' THEN 'hashtag' ELSE topic_type END,
  CASE WHEN topic_type IN ('category', 'hashtag') THEN lower(trim(ltrim(trim(topic_key), '#'))) ELSE topic_key END;
DROP TABLE topic_follows;
ALTER TABLE topic_follows_hashtags RENAME TO topic_follows;
CREATE INDEX idx_topic_follows_user_created ON topic_follows(user_id, topic_type, created_at DESC);
CREATE INDEX idx_topic_follows_topic ON topic_follows(topic_type, topic_key, created_at DESC);


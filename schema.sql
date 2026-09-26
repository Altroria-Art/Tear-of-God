CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT UNIQUE,
  password TEXT,
  bio TEXT,
  avatar_url TEXT,
  university TEXT,
  faculty TEXT,
  major TEXT,
  year TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT,
  following_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ผู้ใช้สามารถติดตามหัวข้อเพื่อปรับ For You ให้ตรงความสนใจยิ่งขึ้น
-- topic_key: hashtag (ไม่รวม # และเก็บเป็น lowercase), หรือ template id
CREATE TABLE IF NOT EXISTS topic_follows (
  user_id TEXT NOT NULL,
  topic_type TEXT NOT NULL CHECK(topic_type IN ('hashtag', 'template')),
  topic_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_type, topic_key),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_topic_follows_user_created
  ON topic_follows(user_id, topic_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_follows_topic
  ON topic_follows(topic_type, topic_key, created_at DESC);

CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  hashtags TEXT,
  user_id TEXT,
  template_id TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT,
  image_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

CREATE TABLE IF NOT EXISTS ranking_items (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ranking_id, user_id),
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  parent_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  hashtags TEXT,
  tiers TEXT,
  use_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS template_views (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, user_id)
);

CREATE TABLE IF NOT EXISTS template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- สถิติความนิยมราย item ต่อ ranking: บันทึกคะแนนตอนสร้าง ranking (freeze ณ เวลานั้น)
-- เพื่อให้ย้อนหลังตามช่วงเวลาได้ถูกต้อง แม้ template จะเปลี่ยนจำนวน tier ในภายหลัง
CREATE TABLE IF NOT EXISTS ranking_item_scores (
  id TEXT PRIMARY KEY,
  ranking_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  tier_index INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ranking_id, item_id),
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rankings_template_id ON rankings(template_id);
CREATE INDEX IF NOT EXISTS idx_ranking_items_ranking_tier ON ranking_items(ranking_id, tier, item_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_comments_ranking_id ON comments(ranking_id);
CREATE INDEX IF NOT EXISTS idx_templates_creator_id ON templates(creator_id);

-- ผู้ใช้เลือก Tier List ที่สะท้อนรสนิยมของตัวเองไว้บนโปรไฟล์ได้สูงสุด 3 รายการ
-- position ใช้สำหรับเรียงลำดับการแสดงผล (ไม่บังคับให้แต่ละรายการมี position ไม่ซ้ำกัน
-- เพื่อให้การกด pin พร้อมกันสองแท็บยังปลอดภัยและไม่ทำให้ transaction ล้ม)
CREATE TABLE IF NOT EXISTS profile_pins (
  user_id TEXT NOT NULL,
  ranking_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, ranking_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profile_pins_user_position
  ON profile_pins(user_id, position ASC, created_at DESC);

-- like/dislike/comment เป็นของ "Community Average" ของ template — ไม่ใช่ ranking เดียว
-- เพราะตาราง Community Average เป็นข้อมูลรวมของเทมเพลต จึงผูกกับ template_id โดยตรง
CREATE TABLE IF NOT EXISTS template_reactions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS template_comments (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES template_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ris_template_time ON ranking_item_scores(template_id, created_at);
CREATE INDEX IF NOT EXISTS idx_template_comments_template ON template_comments(template_id, created_at);

-- 📍 รายงานผู้ใช้ต่อ template — แจ้งแอดมินให้ช่วยตรวจสอบเนื้อหาไม่เหมาะสม
-- status: pending (รอดำเนินการ) | resolved (จัดการแล้ว) | dismissed (ปัดตกไม่ผิด)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  ranking_id TEXT,
  comment_id TEXT,
  template_comment_id TEXT,
  reporter_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  -- UTC 'YYYY-MM-DD HH:MM:SS' set when the report is closed (resolved/dismissed);
  -- cleared on reopen. Drives the 24-hour reopen window + auto-expiry purge.
  closed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_comment_id) REFERENCES template_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_comment_id ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_template_comment_id ON reports(template_comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_parent_id ON template_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_ranking ON reports(ranking_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status_closed_at ON reports(status, closed_at);

CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_created_at   ON rankings(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_tpl_likes    ON rankings(template_id, likes_count DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_user_created ON rankings(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_templates_created ON templates(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_template_items_tpl_position ON template_items(template_id, position);


-- Additive migration. Existing accounts and password hashes are preserved.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_expiry ON auth_attempts(expires_at);
CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY(provider, subject)
);

CREATE TABLE IF NOT EXISTS template_bookmarks (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, template_id)
);
CREATE INDEX IF NOT EXISTS idx_template_bookmarks_template_id ON template_bookmarks(template_id);

-- First-party product analytics. Store only the event taxonomy and anonymous
-- session/entity identifiers needed for funnel analysis; no IP, user agent,
-- free-form text, or form values are persisted.
-- WITHOUT ROWID stores the event UUID once as the primary key. Existing databases
-- require the separately reviewed 0014 rebuild; CREATE IF NOT EXISTS cannot convert them.
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_analytics_event_created
  ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created
  ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session_created
  ON analytics_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created_nonnull
  ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;


-- Password Resets
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- Duels: 1-to-1 taste comparison between challenger and template owner, and vs community average
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

-- Canonical hashtag rows derived from CSV. DISTINCT avoids duplicate tag counts.
CREATE VIEW IF NOT EXISTS ranking_hashtags AS
SELECT DISTINCT r.id AS ranking_id, r.user_id,
  lower(trim(ltrim(trim(tag.value), '#'))) AS hashtag
FROM rankings r, json_each('[' || replace(json_quote(COALESCE(r.hashtags, '')), ',', '","') || ']') tag
WHERE trim(ltrim(trim(tag.value), '#')) <> '';
CREATE VIEW IF NOT EXISTS template_hashtags AS
SELECT DISTINCT t.id AS template_id, t.creator_id,
  lower(trim(ltrim(trim(tag.value), '#'))) AS hashtag
FROM templates t, json_each('[' || replace(json_quote(COALESCE(t.hashtags, '')), ',', '","') || ']') tag
WHERE trim(ltrim(trim(tag.value), '#')) <> '';

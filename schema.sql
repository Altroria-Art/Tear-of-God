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
  equipped_badge_id TEXT DEFAULT NULL,
  equipped_badge_meta TEXT DEFAULT NULL,
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
CREATE INDEX IF NOT EXISTS idx_votes_ranking_created ON votes(ranking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ranking_created ON comments(ranking_id, created_at DESC);
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

-- Reports retain original text and decisions after content deletion.
-- status: pending (รอดำเนินการ) | resolved (จัดการแล้ว) | dismissed (ปัดตกไม่ผิด)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  ranking_id TEXT REFERENCES rankings(id) ON DELETE SET NULL,
  comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL,
  template_comment_id TEXT REFERENCES template_comments(id) ON DELETE SET NULL,
  reporter_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  closed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  target_kind TEXT,
  target_key TEXT,
  content_title TEXT,
  content_text TEXT,
  content_hashtags TEXT,
  context_title TEXT,
  target_removed_at DATETIME,
  moderation_action TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_action IN ('pending','kept','deleted','removed','reopened','legacy')),
  moderated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  moderated_at DATETIME
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
CREATE INDEX IF NOT EXISTS idx_rankings_template_created ON rankings(template_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_activity_user_time ON rankings(user_id, datetime(created_at) DESC, id DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_activity_user_time ON votes(user_id, datetime(created_at) DESC, ranking_id DESC) WHERE vote_type = 'like';
CREATE INDEX IF NOT EXISTS idx_rankings_feed_activity ON rankings(COALESCE(last_activity_at, created_at) DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_items_preview ON ranking_items(ranking_id, position, id);
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

-- Template User Contributions: 7-day cooldown tracking and 1-user-1-vote anti-pumping for Community Average
CREATE TABLE IF NOT EXISTS template_user_contributions (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  current_ranking_id TEXT,
  cooldown_until DATETIME NOT NULL,
  last_contributed_at DATETIME NOT NULL,
  PRIMARY KEY (template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (current_ranking_id) REFERENCES rankings(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tuc_template_current
  ON template_user_contributions(template_id, current_ranking_id);
CREATE INDEX IF NOT EXISTS idx_tuc_user_cooldown
  ON template_user_contributions(user_id, cooldown_until);

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

-- Report snapshots and permanent moderation history.
CREATE TABLE IF NOT EXISTS report_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_actions_report ON report_actions(report_id, id);
CREATE TRIGGER IF NOT EXISTS reports_capture_content AFTER INSERT ON reports
BEGIN
  UPDATE reports SET target_kind = CASE WHEN template_comment_id IS NOT NULL THEN 'template_comment' WHEN comment_id IS NOT NULL THEN 'comment' WHEN ranking_id IS NOT NULL THEN 'post' ELSE 'template' END,
    target_key = COALESCE(template_comment_id, comment_id, ranking_id, template_id),
    content_title = CASE WHEN template_comment_id IS NOT NULL OR comment_id IS NOT NULL THEN NULL WHEN ranking_id IS NOT NULL THEN (SELECT title FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT title FROM templates WHERE id = reports.template_id) END,
    content_text = CASE WHEN template_comment_id IS NOT NULL THEN (SELECT content FROM template_comments WHERE id = reports.template_comment_id) WHEN comment_id IS NOT NULL THEN (SELECT content FROM comments WHERE id = reports.comment_id) WHEN ranking_id IS NOT NULL THEN (SELECT description FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT description FROM templates WHERE id = reports.template_id) END,
    content_hashtags = CASE WHEN ranking_id IS NOT NULL THEN (SELECT hashtags FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT hashtags FROM templates WHERE id = reports.template_id) END,
    context_title = CASE WHEN template_comment_id IS NOT NULL THEN (SELECT t.title FROM templates t JOIN template_comments c ON c.template_id = t.id WHERE c.id = reports.template_comment_id) WHEN comment_id IS NOT NULL THEN (SELECT r.title FROM rankings r JOIN comments c ON c.ranking_id = r.id WHERE c.id = reports.comment_id) ELSE NULL END WHERE id = NEW.id;
  INSERT INTO report_actions (report_id, action, status, created_at) VALUES (NEW.id, NEW.moderation_action, NEW.status, NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS reports_capture_action AFTER UPDATE OF status, moderation_action ON reports
WHEN OLD.status IS NOT NEW.status OR OLD.moderation_action IS NOT NEW.moderation_action
BEGIN
  INSERT INTO report_actions (report_id, action, status, actor_id, actor_name, created_at)
  VALUES (NEW.id, NEW.moderation_action, NEW.status, NEW.moderated_by,
    (SELECT username FROM profiles WHERE id = NEW.moderated_by), COALESCE(NEW.moderated_at, CURRENT_TIMESTAMP));
END;

CREATE TRIGGER IF NOT EXISTS reports_preserve_templates BEFORE DELETE ON templates
BEGIN
  UPDATE reports SET target_removed_at = CURRENT_TIMESTAMP, status = 'resolved',
    closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
    moderation_action = CASE WHEN moderation_action = 'deleted' THEN 'deleted' ELSE 'removed' END,
    moderated_by = CASE WHEN moderation_action = 'deleted' THEN moderated_by ELSE NULL END,
    moderated_at = CASE WHEN moderation_action = 'deleted' THEN moderated_at ELSE CURRENT_TIMESTAMP END
  WHERE template_id = OLD.id AND target_kind = 'template';
END;

CREATE TRIGGER IF NOT EXISTS reports_preserve_rankings BEFORE DELETE ON rankings
BEGIN
  UPDATE reports SET target_removed_at = CURRENT_TIMESTAMP, status = 'resolved',
    closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
    moderation_action = CASE WHEN moderation_action = 'deleted' THEN 'deleted' ELSE 'removed' END,
    moderated_by = CASE WHEN moderation_action = 'deleted' THEN moderated_by ELSE NULL END,
    moderated_at = CASE WHEN moderation_action = 'deleted' THEN moderated_at ELSE CURRENT_TIMESTAMP END
  WHERE ranking_id = OLD.id AND target_kind = 'post';
END;

CREATE TRIGGER IF NOT EXISTS reports_preserve_comments BEFORE DELETE ON comments
BEGIN
  UPDATE reports SET target_removed_at = CURRENT_TIMESTAMP, status = 'resolved',
    closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
    moderation_action = CASE WHEN moderation_action = 'deleted' THEN 'deleted' ELSE 'removed' END,
    moderated_by = CASE WHEN moderation_action = 'deleted' THEN moderated_by ELSE NULL END,
    moderated_at = CASE WHEN moderation_action = 'deleted' THEN moderated_at ELSE CURRENT_TIMESTAMP END
  WHERE comment_id = OLD.id AND target_kind = 'comment';
END;

CREATE TRIGGER IF NOT EXISTS reports_preserve_template_comments BEFORE DELETE ON template_comments
BEGIN
  UPDATE reports SET target_removed_at = CURRENT_TIMESTAMP, status = 'resolved',
    closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
    moderation_action = CASE WHEN moderation_action = 'deleted' THEN 'deleted' ELSE 'removed' END,
    moderated_by = CASE WHEN moderation_action = 'deleted' THEN moderated_by ELSE NULL END,
    moderated_at = CASE WHEN moderation_action = 'deleted' THEN moderated_at ELSE CURRENT_TIMESTAMP END
  WHERE template_comment_id = OLD.id AND target_kind = 'template_comment';
END;

-- Exact template usage counters (migration 0029).
-- Independent of the legacy templates.use_count mirror and its app writers.
-- Apply before enabling TEMPLATE_USAGE_COUNTERS=true; older code stays valid.
CREATE TABLE IF NOT EXISTS template_usage_counts (
  template_id TEXT PRIMARY KEY REFERENCES templates(id) ON DELETE CASCADE,
  ranking_count INTEGER NOT NULL DEFAULT 0 CHECK (ranking_count >= 0)
) WITHOUT ROWID;

INSERT INTO template_usage_counts(template_id, ranking_count)
SELECT t.id, (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id)
FROM templates t WHERE true
ON CONFLICT(template_id) DO UPDATE SET ranking_count = excluded.ranking_count;

CREATE TRIGGER IF NOT EXISTS template_usage_ranking_insert AFTER INSERT ON rankings
WHEN NEW.template_id IS NOT NULL
BEGIN
  INSERT INTO template_usage_counts(template_id, ranking_count)
  SELECT id, 1 FROM templates WHERE id = NEW.template_id
  ON CONFLICT(template_id) DO UPDATE SET ranking_count = ranking_count + 1;
END;

CREATE TRIGGER IF NOT EXISTS template_usage_ranking_delete AFTER DELETE ON rankings
WHEN OLD.template_id IS NOT NULL
BEGIN
  UPDATE template_usage_counts SET ranking_count = ranking_count - 1
  WHERE template_id = OLD.template_id AND ranking_count > 0;
END;

CREATE TRIGGER IF NOT EXISTS template_usage_ranking_move AFTER UPDATE OF template_id ON rankings
WHEN OLD.template_id IS NOT NEW.template_id
BEGIN
  UPDATE template_usage_counts SET ranking_count = ranking_count - 1
  WHERE template_id = OLD.template_id AND ranking_count > 0;
  INSERT INTO template_usage_counts(template_id, ranking_count)
  SELECT id, 1 FROM templates WHERE id = NEW.template_id
  ON CONFLICT(template_id) DO UPDATE SET ranking_count = ranking_count + 1;
END;

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
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  user_id TEXT,
  template_id TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT,
  image_url TEXT
);

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
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  tiers TEXT,
  use_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
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
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rankings_user_id ON rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_rankings_category ON rankings(category);
CREATE INDEX IF NOT EXISTS idx_rankings_template_id ON rankings(template_id);
CREATE INDEX IF NOT EXISTS idx_ranking_items_ranking_id ON ranking_items(ranking_id);
CREATE INDEX IF NOT EXISTS idx_votes_ranking_id ON votes(ranking_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_comments_ranking_id ON comments(ranking_id);
CREATE INDEX IF NOT EXISTS idx_templates_creator_id ON templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_template_views_template ON template_views(template_id);
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
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ris_ranking ON ranking_item_scores(ranking_id);
CREATE INDEX IF NOT EXISTS idx_ris_template_time ON ranking_item_scores(template_id, created_at);
CREATE INDEX IF NOT EXISTS idx_template_reactions_template ON template_reactions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_reactions_user ON template_reactions(template_id, user_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_template ON template_comments(template_id, created_at);

-- 📍 รายงานผู้ใช้ต่อ template — แจ้งแอดมินให้ช่วยตรวจสอบเนื้อหาไม่เหมาะสม
-- status: pending (รอดำเนินการ) | resolved (จัดการแล้ว) | dismissed (ปัดตกไม่ผิด)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  ranking_id TEXT,
  reporter_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_ranking ON reports(ranking_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

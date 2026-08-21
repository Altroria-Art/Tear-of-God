CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  user_id TEXT,
  template_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_rankings_user_id ON rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_rankings_category ON rankings(category);
CREATE INDEX IF NOT EXISTS idx_rankings_template_id ON rankings(template_id);
CREATE INDEX IF NOT EXISTS idx_ranking_items_ranking_id ON ranking_items(ranking_id);
CREATE INDEX IF NOT EXISTS idx_votes_ranking_id ON votes(ranking_id);
CREATE INDEX IF NOT EXISTS idx_comments_ranking_id ON comments(ranking_id);
CREATE INDEX IF NOT EXISTS idx_templates_creator_id ON templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_template_views_template ON template_views(template_id);
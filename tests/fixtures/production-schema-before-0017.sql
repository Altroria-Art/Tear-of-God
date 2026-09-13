-- Synthetic-test schema matching the Production D1 shape audited in Phase 3B.
-- It intentionally contains the three drifts repaired by migration 0017.

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  bio TEXT,
  university TEXT,
  faculty TEXT,
  major TEXT,
  year TEXT,
  role TEXT DEFAULT 'user'
);

CREATE TABLE follows (
  follower_id TEXT,
  following_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT,
  image_url TEXT
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  tiers TEXT,
  use_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_templates_creator_id ON templates(creator_id);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_use_count ON templates(use_count DESC, created_at DESC, id DESC);
CREATE INDEX idx_templates_view_count ON templates(view_count DESC, use_count DESC, id DESC);

CREATE TABLE rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  template_id TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_category ON rankings(category);
CREATE INDEX idx_rankings_template_id ON rankings(template_id);
CREATE INDEX idx_rankings_created_at ON rankings(created_at DESC, id DESC);
CREATE INDEX idx_rankings_cat_created ON rankings(category, created_at DESC, id DESC);
CREATE INDEX idx_rankings_tpl_likes ON rankings(template_id, likes_count DESC, created_at DESC, id DESC);
CREATE INDEX idx_rankings_user_created ON rankings(user_id, created_at DESC, id DESC);

CREATE TABLE template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);
CREATE INDEX idx_template_items_template_id ON template_items(template_id);
CREATE INDEX idx_template_items_tpl_position ON template_items(template_id, position);

CREATE TABLE ranking_items (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);
CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id);

CREATE TABLE ranking_item_scores (
  id TEXT PRIMARY KEY,
  ranking_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  tier_index INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);
CREATE INDEX idx_ris_ranking ON ranking_item_scores(ranking_id);
CREATE INDEX idx_ris_template_time ON ranking_item_scores(template_id, created_at);

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ranking_id, user_id),
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_votes_ranking_id ON votes(ranking_id);
CREATE INDEX idx_votes_user_id ON votes(user_id, vote_type);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_ranking_id ON comments(ranking_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

CREATE TABLE template_views (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, user_id)
);
CREATE INDEX idx_template_views_template ON template_views(template_id);

CREATE TABLE template_reactions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_template_reactions_template ON template_reactions(template_id);
CREATE INDEX idx_template_reactions_user ON template_reactions(template_id, user_id);

CREATE TABLE template_comments (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  parent_id TEXT REFERENCES template_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_template_comments_template ON template_comments(template_id, created_at);
CREATE INDEX idx_template_comments_parent_id ON template_comments(parent_id);

CREATE TABLE template_bookmarks (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, template_id)
);
CREATE INDEX idx_template_bookmarks_template_id ON template_bookmarks(template_id);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  ranking_id TEXT,
  reporter_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  template_comment_id TEXT REFERENCES template_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX idx_reports_comment_id ON reports(comment_id);
CREATE INDEX idx_reports_ranking ON reports(ranking_id);
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status, created_at);
CREATE INDEX idx_reports_template ON reports(template_id);
CREATE INDEX idx_reports_template_comment_id ON reports(template_comment_id);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_attempts_expiry ON auth_attempts(expires_at);

CREATE TABLE auth_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY(provider, subject)
);

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

CREATE TABLE d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

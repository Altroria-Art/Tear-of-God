-- templates / template_items were empty on both local and production D1
-- (verified via SELECT COUNT(*) before writing this migration), so it is
-- safe to drop and recreate with the columns the app actually needs.
DROP TABLE IF EXISTS template_items;
DROP TABLE IF EXISTS templates;

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
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_creator_id ON templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);

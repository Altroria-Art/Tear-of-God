-- Additive only (no DROP) — safe to run against production, unlike 0001.
ALTER TABLE templates ADD COLUMN view_count INTEGER DEFAULT 0;

-- One row per (template, user) lets "first open only" counting fall out of
-- INSERT OR IGNORE for free, instead of needing a read-then-write check.
CREATE TABLE IF NOT EXISTS template_views (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_template_views_template ON template_views(template_id);

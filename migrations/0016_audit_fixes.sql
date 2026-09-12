-- Fix M3: Add missing indexes for foreign keys to prevent full table scans
CREATE INDEX IF NOT EXISTS idx_reports_comment_id ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_template_comment_id ON reports(template_comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_parent_id ON template_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_template_bookmarks_template_id ON template_bookmarks(template_id);

-- Fix M4: Drop unused 'sessions' table (the system uses 'auth_sessions' instead)
DROP TABLE IF EXISTS sessions;

-- Fix L4: Drop redundant trigger that conflicts with manual app-level cascading
DROP TRIGGER IF EXISTS trg_reports_ranking_delete;

-- 0019: Retain reports, original content snapshots and moderation history.
-- Existing deleted/expired reports cannot be recovered. Apply before the matching app release.
PRAGMA defer_foreign_keys = ON;
DROP TRIGGER IF EXISTS trg_reports_ranking_delete;
CREATE TABLE reports_retained (
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
INSERT INTO reports_retained (id, template_id, ranking_id, comment_id, template_comment_id, reporter_id, reason, status, closed_at, created_at, moderation_action, moderated_at)
SELECT id, template_id, ranking_id, comment_id, template_comment_id, reporter_id, reason, status, closed_at, created_at,
  CASE WHEN status = 'pending' THEN 'pending' ELSE 'legacy' END, closed_at FROM reports;
DROP TABLE reports;
ALTER TABLE reports_retained RENAME TO reports;
CREATE INDEX IF NOT EXISTS idx_reports_comment_id ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_template_comment_id ON reports(template_comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_ranking ON reports(ranking_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status_closed_at ON reports(status, closed_at);
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
UPDATE reports SET target_kind = CASE WHEN template_comment_id IS NOT NULL THEN 'template_comment' WHEN comment_id IS NOT NULL THEN 'comment' WHEN ranking_id IS NOT NULL THEN 'post' ELSE 'template' END,
    target_key = COALESCE(template_comment_id, comment_id, ranking_id, template_id),
    content_title = CASE WHEN template_comment_id IS NOT NULL OR comment_id IS NOT NULL THEN NULL WHEN ranking_id IS NOT NULL THEN (SELECT title FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT title FROM templates WHERE id = reports.template_id) END,
    content_text = CASE WHEN template_comment_id IS NOT NULL THEN (SELECT content FROM template_comments WHERE id = reports.template_comment_id) WHEN comment_id IS NOT NULL THEN (SELECT content FROM comments WHERE id = reports.comment_id) WHEN ranking_id IS NOT NULL THEN (SELECT description FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT description FROM templates WHERE id = reports.template_id) END,
    content_hashtags = CASE WHEN ranking_id IS NOT NULL THEN (SELECT hashtags FROM rankings WHERE id = reports.ranking_id) ELSE (SELECT hashtags FROM templates WHERE id = reports.template_id) END,
    context_title = CASE WHEN template_comment_id IS NOT NULL THEN (SELECT t.title FROM templates t JOIN template_comments c ON c.template_id = t.id WHERE c.id = reports.template_comment_id) WHEN comment_id IS NOT NULL THEN (SELECT r.title FROM rankings r JOIN comments c ON c.ranking_id = r.id WHERE c.id = reports.comment_id) ELSE NULL END;
INSERT INTO report_actions (report_id, action, status, created_at)
SELECT id, moderation_action, status, COALESCE(closed_at, created_at) FROM reports;
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
PRAGMA defer_foreign_keys = OFF;

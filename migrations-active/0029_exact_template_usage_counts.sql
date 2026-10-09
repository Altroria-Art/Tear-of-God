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

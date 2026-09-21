-- Requires 0012. Rebuild only the analytics child table; preserve every event.
-- Run as one transaction. Estimate rebuild writes before scheduling this migration.
CREATE TABLE __quota_0014_guard (passed INTEGER NOT NULL CHECK (passed = 1));
INSERT INTO __quota_0014_guard
SELECT CASE WHEN
  (SELECT COUNT(*) FROM pragma_table_info('analytics_events')) = 7
  AND NOT EXISTS (SELECT 1 FROM analytics_events WHERE id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM sqlite_schema WHERE type = 'trigger'
    AND (tbl_name = 'analytics_events' OR lower(sql) LIKE '%analytics_events%'))
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT name FROM sqlite_schema WHERE type = 'table'
        AND name NOT GLOB '_cf_*' AND name NOT GLOB 'sqlite_*' LIMIT -1
    ) s, pragma_foreign_key_list(s.name) f
    WHERE f."table" = 'analytics_events'
  )
  AND NOT EXISTS (SELECT 1 FROM sqlite_schema WHERE type = 'view' AND lower(sql) LIKE '%analytics_events%')
  AND NOT EXISTS (
    SELECT 1 FROM sqlite_schema WHERE type = 'index' AND tbl_name = 'analytics_events'
      AND sql IS NOT NULL AND name NOT IN ('idx_analytics_event_created','idx_analytics_created',
        'idx_analytics_session_created','idx_analytics_user_created_nonnull')
  )
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE name = 'idx_analytics_user_created_nonnull')
THEN 1 ELSE 0 END;

CREATE TABLE analytics_events_compact (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) WITHOUT ROWID;
INSERT INTO analytics_events_compact (id,event_name,session_id,user_id,entity_type,entity_id,created_at)
SELECT id,event_name,session_id,user_id,entity_type,entity_id,created_at FROM analytics_events;
INSERT INTO __quota_0014_guard
SELECT CASE WHEN (SELECT COUNT(*) FROM analytics_events_compact) = (SELECT COUNT(*) FROM analytics_events)
  THEN 1 ELSE 0 END;
DROP TABLE analytics_events;
ALTER TABLE analytics_events_compact RENAME TO analytics_events;
CREATE INDEX idx_analytics_event_created ON analytics_events(event_name, created_at DESC);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_session_created ON analytics_events(session_id, created_at DESC);
CREATE INDEX idx_analytics_user_created_nonnull ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
DROP TABLE __quota_0014_guard;

-- Independent of 0012. The tier range excludes unranked (NULL-tier) items.
-- Replace the prefix index so placement inserts maintain the same index count.
-- Require the default rowid table (the application uses rowid for position ties).
CREATE TABLE __quota_0013_guard (passed INTEGER NOT NULL CHECK (passed = 1));
INSERT INTO __quota_0013_guard
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pragma_table_list WHERE name = 'ranking_items' AND wr = 0
) AND (NOT EXISTS (
  SELECT 1 FROM sqlite_schema WHERE name = 'idx_ranking_items_ranking_tier'
) OR EXISTS (
  SELECT 1 FROM pragma_index_list('ranking_items') i
  WHERE i.name = 'idx_ranking_items_ranking_tier' AND i.partial = 0 AND i."unique" = 0
    AND (SELECT COUNT(*) FROM pragma_index_info(i.name)) = 3
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 0) = 'ranking_id'
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 1) = 'tier'
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 2) = 'item_id'
    AND NOT EXISTS (SELECT 1 FROM pragma_index_xinfo(i.name) WHERE key = 1 AND coll <> 'BINARY')
)) THEN 1 ELSE 0 END;
CREATE INDEX IF NOT EXISTS idx_ranking_items_ranking_tier
  ON ranking_items(ranking_id, tier, item_id);
DROP INDEX IF EXISTS idx_ranking_items_ranking_id;
DROP TABLE __quota_0013_guard;
